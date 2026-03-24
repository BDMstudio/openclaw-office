import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { ChatDockMessage } from "@/store/console-stores/chat-dock-store";
import { MarkdownContent } from "./MarkdownContent";
import { StreamingIndicator } from "./StreamingIndicator";

interface MessageBubbleProps {
  message: ChatDockMessage;
  isPinned?: boolean;
  onTogglePin?: (messageId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isPinned = false,
  onTogglePin,
}: MessageBubbleProps) {
  const { t } = useTranslation("chat");
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const hasImages = (message.attachments ?? []).some((attachment) => attachment.dataUrl);

  if (isSystem) {
    return (
      <div className="mb-3 flex justify-center">
        <div className="max-w-2xl rounded-lg bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="flex items-start justify-between gap-3">
            <MarkdownContent content={message.content} />
            {onTogglePin && (
              <button
                type="button"
                onClick={() => onTogglePin(message.id)}
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                  isPinned
                    ? "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
                    : "text-amber-500 hover:text-amber-700 dark:text-amber-400"
                }`}
              >
                {isPinned ? t("message.pinned") : t("message.pin")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="group mb-5 flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-gray-800 px-4 py-3 text-sm text-gray-100 dark:bg-gray-200 dark:text-gray-900">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          {hasImages && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {message.attachments?.map((attachment) =>
                attachment.dataUrl ? (
                  <img
                    key={attachment.id}
                    src={attachment.dataUrl}
                    alt={attachment.name ?? attachment.mimeType}
                    className="h-28 w-full rounded-lg object-cover"
                  />
                ) : null,
              )}
            </div>
          )}
        </div>
        {onTogglePin && (
          <button
            type="button"
            onClick={() => onTogglePin(message.id)}
            className={`ml-1 mt-1 shrink-0 self-start rounded px-1.5 py-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 ${
              isPinned
                ? "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            }`}
          >
            {isPinned ? t("message.pinned") : t("message.pin")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="group mb-5">
      <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
        <MarkdownContent content={message.content} />
        {message.isStreaming && <StreamingIndicator />}
      </div>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.toolCalls.map((toolCall) => (
            <div
              key={toolCall.id}
              className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-2.5 py-1.5 text-xs dark:bg-gray-800"
            >
              <span className="font-mono text-gray-600 dark:text-gray-300">{toolCall.name}</span>
              <span className="rounded bg-gray-200/80 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                {t(`toolStatus.${toolCall.status}`, { defaultValue: toolCall.status })}
              </span>
            </div>
          ))}
        </div>
      )}
      {hasImages && (
        <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
          {message.attachments?.map((attachment) =>
            attachment.dataUrl ? (
              <img
                key={attachment.id}
                src={attachment.dataUrl}
                alt={attachment.name ?? attachment.mimeType}
                className="h-28 w-full rounded-lg object-cover"
              />
            ) : null,
          )}
        </div>
      )}
      {onTogglePin && (
        <button
          type="button"
          onClick={() => onTogglePin(message.id)}
          className={`mt-1 rounded px-1.5 py-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 ${
            isPinned
              ? "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          }`}
        >
          {isPinned ? t("message.pinned") : t("message.pin")}
        </button>
      )}
    </div>
  );
});
