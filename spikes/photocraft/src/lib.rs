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

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn blend_known_colors() { assert!((astralys_blend(0,0.5,0.25)-0.125).abs()<1e-6); assert!((astralys_blend(1,0.5,0.25)-0.625).abs()<1e-6); }
    #[test] fn invalid_inputs_fail_closed() { for (m,b,s) in [(2,0.5,0.5),(0,-1.0,0.5),(0,f32::INFINITY,0.5),(0,0.5,f32::NAN)] { assert!(astralys_blend(m,b,s).is_nan()); } }
}
