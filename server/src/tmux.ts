import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type TmuxTarget = {
  socket: string;
  session: string;
};

export async function tmuxCapture(target: TmuxTarget, paneIndex: number, lines = 200) {
  const pane = `${target.session}:0.${paneIndex}`;
  const args = ['-S', target.socket, 'capture-pane', '-p', '-J', '-t', pane, '-S', `-${lines}`];
  const { stdout } = await execFileAsync('tmux', args, { maxBuffer: 1024 * 1024 * 10 });
  return stdout;
}

export async function tmuxSend(target: TmuxTarget, paneIndex: number, text: string) {
  const pane = `${target.session}:0.${paneIndex}`;

  // send text as literal, then Enter separately (tmux skill guidance)
  await execFileAsync('tmux', ['-S', target.socket, 'send-keys', '-t', pane, '-l', '--', text]);
  await execFileAsync('tmux', ['-S', target.socket, 'send-keys', '-t', pane, 'Enter']);
}
