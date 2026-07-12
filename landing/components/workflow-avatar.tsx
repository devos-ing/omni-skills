import Avatar from "boring-avatars";

const workflowAvatarColors = ["#A78BFA", "#22D3EE", "#34D399", "#F59E0B", "#FB7185"];

interface WorkflowAvatarProps {
  seed: string;
  label: string;
  size?: number;
}

export function WorkflowAvatar({ seed, label, size = 40 }: WorkflowAvatarProps) {
  return (
    <span
      role="img"
      aria-label={`${label} workflow avatar`}
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#dedbd3]/10 bg-white p-1"
      style={{ width: size + 8, height: size + 8 }}
    >
      <Avatar name={seed} size={size} variant="beam" colors={workflowAvatarColors} title={false} />
    </span>
  );
}
