export interface PhotoState { turns: number; flip: boolean; }
export class PhotoHistory {
  private states: PhotoState[] = [{turns:0,flip:false}];
  get current() { return this.states.at(-1)!; }
  get canUndo() { return this.states.length>1; }
  checkpoint() { return this.states.map(s=>({...s})); }
  restore(states: PhotoState[]) { this.states=states.map(s=>({...s})); }
  rotate() { this.push({...this.current,turns:(this.current.turns+1)%4}); }
  flip() { this.push({...this.current,flip:!this.current.flip}); }
  undo() { if(this.canUndo)this.states.pop(); }
  reset() { this.states=[{turns:0,flip:false}]; }
  private push(state: PhotoState) { this.states.push(state); if(this.states.length>32)this.states.splice(1,1); }
}
