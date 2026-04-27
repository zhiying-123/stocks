"use client";

type ConfirmDeleteButtonProps = {
  label?: string;
  message: string;
  className?: string;
};

export default function ConfirmDeleteButton({
  label = "Delete Account",
  message,
  className,
}: ConfirmDeleteButtonProps) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!confirm(message)) {
          event.preventDefault();
        }
      }}
      className={className}
    >
      {label}
    </button>
  );
}
