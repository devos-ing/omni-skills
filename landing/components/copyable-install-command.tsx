import { CopyableCommand } from "./copyable-command";

interface CopyableInstallCommandProps {
  command: string;
}

export function CopyableInstallCommand({ command }: CopyableInstallCommandProps) {
  return (
    <CopyableCommand command={command} label="install command" copyLabel="Copy install command" />
  );
}
