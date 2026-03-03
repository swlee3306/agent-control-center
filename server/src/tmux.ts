import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type TmuxTarget = {
  socket: string;
  session: string;
};

export type PaneInfo = {
  index: number;
  title: string;
  currentCommand: string;
};

export async function tmuxListPanes(target: TmuxTarget): Promise<PaneInfo[]> {
  const { stdout } = await execFileAsync('tmux', [
    '-S',
    target.socket,
    'list-panes',
    '-t',
    `${target.session}:0`,
    '-F',
    '#{pane_index}\t#{pane_title}\t#{pane_current_command}',
  ]);

  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [idx, title, cmd] = line.split('\t');
      return { index: Number(idx), title: title ?? '', currentCommand: cmd ?? '' };
    });
}

export async function tmuxResolvePaneIndexByTitle(target: TmuxTarget, title: string): Promise<number | null> {
  const panes = await tmuxListPanes(target);
  const hit = panes.find((p) => p.title === title);
  return hit ? hit.index : null;
}

export async function tmuxCapture(target: TmuxTarget, paneIndex: number, lines = 200) {
  const pane = `${target.session}:0.${paneIndex}`;
  const args = ['-S', target.socket, 'capture-pane', '-p', '-J', '-t', pane, '-S', `-${lines}`];
  const { stdout } = await execFileAsync('tmux', args, { maxBuffer: 1024 * 1024 * 10 });
  return stdout;
}

export async function tmuxSend(target: TmuxTarget, paneIndex: number, text: string) {
  const pane = `${target.session}:0.${paneIndex}`;

  // send text as literal, then Enter separately
  await execFileAsync('tmux', ['-S', target.socket, 'send-keys', '-t', pane, '-l', '--', text]);
  await execFileAsync('tmux', ['-S', target.socket, 'send-keys', '-t', pane, 'Enter']);
}

export async function tmuxPaneCurrentCommand(target: TmuxTarget, paneIndex: number) {
  const pane = `${target.session}:0.${paneIndex}`;
  const { stdout } = await execFileAsync('tmux', [
    '-S',
    target.socket,
    'display-message',
    '-p',
    '-t',
    pane,
    '#{pane_current_command}',
  ]);
  return stdout.trim();
}
