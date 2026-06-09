"use client";

import { useRef } from "react";
import { Loader2, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { fileInputAccept } from "@/utils/files";

/**
 * The "+" attachment button shown inside the composer (ChatGPT/Claude style).
 * Opens a menu whose action picks a file; the parent handles the upload.
 */
export function ComposerAttachMenu({
  onFile,
  uploading = false,
  disabled = false,
}: {
  onFile: (file: File) => void;
  uploading?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={fileInputAccept()}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 rounded-full"
            disabled={disabled || uploading}
            aria-label="Add attachment"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Plus className="size-5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-60">
          <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
            <Paperclip />
            Add files or photos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
