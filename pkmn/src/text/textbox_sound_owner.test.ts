import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../input',()=>({isHeld:vi.fn(()=>false),isPressed:vi.fn(()=>false),syncJoypadRead:vi.fn()}));
vi.mock('../audio',()=>({playSFX:vi.fn(),isSoundFinished:vi.fn(()=>true)}));
vi.mock('../renderer',()=>({drawTile:vi.fn(),fillRect:vi.fn(),loadFont:async()=>({width:128}),loadTileset:async()=>({width:128})}));
import { TextBox, setTextSpeed } from './textbox';
import { loadTextPrograms } from './program_data';
import { playSFX, isSoundFinished } from '../audio';
import { isHeld } from '../input';
beforeAll(loadTextPrograms);
beforeEach(()=>{vi.clearAllMocks();vi.mocked(isHeld).mockReturnValue(false);vi.mocked(isSoundFinished).mockReturnValue(true);setTextSpeed('fast');});
it('without a sound port TextBox retains the facade sound-command and wait behavior',()=>{
 const box=new TextBox();vi.mocked(isSoundFinished).mockReturnValue(false);
 box.printStandalone({program:'GrewLevelText'},{bindings:{nameBuffer:'BIRD',curEnemyLevel:21}});
 for(let n=0;n<300&&!vi.mocked(playSFX).mock.calls.length;n++)box.update();
 expect(playSFX).toHaveBeenCalledExactlyOnceWith('get_item1');expect(isSoundFinished).toHaveBeenCalled();
 expect(box.isComplete).toBe(false);for(let n=0;n<10;n++)box.update();expect(box.isComplete).toBe(false);
 vi.mocked(isSoundFinished).mockReturnValue(true);box.update();expect(box.isComplete).toBe(true);
});
it('without a sound port TextBox retains the facade acknowledgement beep',()=>{
 const box=new TextBox();box.printStandalone({text:'A<PROMPT>'});
 for(let n=0;n<30;n++)box.update();vi.mocked(isHeld).mockImplementation(k=>k==='a');box.update();
 expect(playSFX).toHaveBeenCalledExactlyOnceWith('press_ab');expect(box.isComplete).toBe(true);
});
