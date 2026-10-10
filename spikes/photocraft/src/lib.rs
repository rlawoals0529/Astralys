//! Original Astralys bridge. Upstream remains unmodified; this is a feasibility spike.
use photocraft_color::blend::{BlendMode, blend_channel};

/// Bounded scalar seam: 0 = multiply, 1 = screen. Invalid input returns NaN.
/// No pointer/allocator ABI, file parser, network, fonts, GUI or arbitrary commands.
#[unsafe(no_mangle)]
pub extern "C" fn astralys_blend(mode: u32, backdrop: f32, source: f32) -> f32 {
    if !backdrop.is_finite() || !source.is_finite() || !(0.0..=1.0).contains(&backdrop) || !(0.0..=1.0).contains(&source) { return f32::NAN; }
    let mode = match mode { 0 => BlendMode::Multiply, 1 => BlendMode::Screen, _ => return f32::NAN };
    blend_channel(mode, backdrop, source)
}

// Single-threaded WASM experiment: three fixed 64x64 RGBA planes.
// No host-controlled allocator, unbounded pointer/length pairs or dynamic growth.
// Layout: backdrop, source, result; each has PLANE_BYTES capacity.
const SIDE: usize = 64;
const PLANE_BYTES: usize = SIDE * SIDE * 4;
static mut TILES: [u8; PLANE_BYTES * 3] = [0; PLANE_BYTES * 3];

/// The fixed-size arena remains owned by this module. Caller writes only to
/// its first two planes, within documented bounds, from a non-shared worker.
#[unsafe(no_mangle)]
pub extern "C" fn astralys_tile_ptr() -> *mut u8 {
    core::ptr::addr_of_mut!(TILES).cast::<u8>()
}

/// Return 0 on success, 1 for invalid mode, geometry or opacity.
/// Blend width*height straight RGBA8 pixels, source-over, with mode 0 multiply
/// or 1 screen. Opacity scales source alpha. Inputs are not modified.
/// Output outside the active region is zeroed.
#[unsafe(no_mangle)]
pub extern "C" fn astralys_tile_blend(mode: u32, width: u32, height: u32, opacity: f32) -> u32 {
    if mode > 1 || width == 0 || height == 0 ||
        width > SIDE as u32 || height > SIDE as u32 ||
        !opacity.is_finite() || !(0.0..=1.0).contains(&opacity) {
        return 1;
    }
    let count = width as usize * height as usize;
    let ptr = astralys_tile_ptr();
    // SAFETY: every active pixel index is within its separate fixed plane,
    // as proven by the width/height check; this experimental module is invoked
    // synchronously in one non-shared worker.
    unsafe {
        core::ptr::write_bytes(ptr.add(PLANE_BYTES * 2), 0, PLANE_BYTES);
        for i in 0..count {
            let o = i * 4;
            let backdrop_alpha = (*ptr.add(o + 3) as f32) / 255.0;
            let source_alpha = (*ptr.add(PLANE_BYTES + o + 3) as f32) / 255.0 * opacity;
            let out_alpha = source_alpha + backdrop_alpha * (1.0 - source_alpha);
            *ptr.add(PLANE_BYTES * 2 + o + 3) = (out_alpha * 255.0).round() as u8;
            if out_alpha == 0.0 { continue; }

            for c in 0..3 {
                let b = (*ptr.add(o + c) as f32) / 255.0;
                let s = (*ptr.add(PLANE_BYTES + o + c) as f32) / 255.0;
                let blend_mode = if mode == 0 { BlendMode::Multiply } else { BlendMode::Screen };
                let mixed = blend_channel(blend_mode, b, s);
                let composited = ((1.0 - source_alpha) * backdrop_alpha * b
                    + (1.0 - backdrop_alpha) * source_alpha * s
                    + backdrop_alpha * source_alpha * mixed) / out_alpha;
                *ptr.add(PLANE_BYTES * 2 + o + c) =
                    (composited.clamp(0.0, 1.0) * 255.0).round() as u8;
            }
        }
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn blend_known_colors() { assert!((astralys_blend(0,0.5,0.25)-0.125).abs()<1e-6); assert!((astralys_blend(1,0.5,0.25)-0.625).abs()<1e-6); }
    #[test] fn invalid_inputs_fail_closed() { for (m,b,s) in [(2,0.5,0.5),(0,-1.0,0.5),(0,f32::INFINITY,0.5),(0,0.5,f32::NAN)] { assert!(astralys_blend(m,b,s).is_nan()); } }
    #[test]
    fn tile_blends_alpha_preserves_inputs_and_rejects_bounds() {
        let ptr = astralys_tile_ptr();
        let backdrop = [255, 0, 0, 255];
        let source = [0, 0, 255, 255];
        unsafe {
            core::ptr::copy_nonoverlapping(backdrop.as_ptr(), ptr, 4);
            core::ptr::copy_nonoverlapping(source.as_ptr(), ptr.add(PLANE_BYTES), 4);
        }
        assert_eq!(astralys_tile_blend(0, 1, 1, 0.5), 0);
        unsafe {
            assert_eq!(core::slice::from_raw_parts(ptr.add(PLANE_BYTES * 2), 4), &[128, 0, 0, 255]);
        }
        assert_eq!(astralys_tile_blend(1, 1, 1, 0.5), 0);
        unsafe {
            assert_eq!(core::slice::from_raw_parts(ptr.add(PLANE_BYTES * 2), 4), &[255, 0, 128, 255]);
            assert_eq!(core::slice::from_raw_parts(ptr, 4), &backdrop);
            assert_eq!(core::slice::from_raw_parts(ptr.add(PLANE_BYTES), 4), &source);
        }
        for (mode, w, h, opacity) in [(0, 65, 1, 0.5), (1, 1, 0, -0.1),
                                      (2, 1, 1, 0.5), (0, 0, 1, 0.5),
                                      (0, 1, 1, f32::NAN)] {
            assert_eq!(astralys_tile_blend(mode, w, h, opacity), 1);
        }
        unsafe {
            assert_eq!(core::slice::from_raw_parts(ptr.add(PLANE_BYTES * 2), 4), &[255, 0, 128, 255]);
        }
        let last = PLANE_BYTES - 4;
        unsafe {
            core::ptr::copy_nonoverlapping(backdrop.as_ptr(), ptr.add(last), 4);
            core::ptr::copy_nonoverlapping(source.as_ptr(), ptr.add(PLANE_BYTES + last), 4);
        }
        assert_eq!(astralys_tile_blend(0, 64, 64, 0.5), 0);
        unsafe {
            assert_eq!(core::slice::from_raw_parts(ptr.add(PLANE_BYTES * 3 - 4), 4), &[128, 0, 0, 255]);
        }
    }
}
