type Props = {
  messages: (string | undefined)[];
};

export function QueryErrorLine({ messages }: Props) {
  const text = messages.find(Boolean);
  if (!text) return null;
  return <p className="text-sm text-red-600">{text}</p>;
}
