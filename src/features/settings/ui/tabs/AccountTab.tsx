import { useEffect, useRef, useState } from "react";
import { Camera2Line, Delete2Line } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { useAuthStore } from "@/features/auth";
import { UserAvatar, useToast } from "@/shared/ui";
import { SettingSection } from "../controls";

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const MAX_AVATAR_DATA_URL_LENGTH = 32_000;
const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const inputClass =
  "w-full rounded-[10px] border border-border-primary/60 bg-bg-surface/70 px-[12px] py-[9px] text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-text-tertiary";
const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

async function optimizeAvatar(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  try {
    let longestSide = 256;
    while (longestSide >= 64) {
      const scale = Math.min(
        1,
        longestSide / Math.max(image.width, image.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not process this image.");

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.68, 0.54, 0.4]) {
        const dataUrl = canvas.toDataURL("image/webp", quality);
        if (
          dataUrl.startsWith("data:image/webp;") &&
          dataUrl.length <= MAX_AVATAR_DATA_URL_LENGTH
        ) {
          return dataUrl;
        }
      }
      longestSide = Math.floor(longestSide / 2);
    }
  } finally {
    image.close();
  }
  throw new Error("This image could not be compressed to the supported size.");
}

export function AccountTab() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  useEffect(() => {
    setUsername(user?.username ?? "");
    setDisplayName(user?.displayName ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
  }, [user?.id, user?.username, user?.displayName, user?.avatarUrl]);

  const handleSelectAvatar = async (file?: File) => {
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast(t("settings.account.invalid_image"), "error");
      return;
    }
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      toast(t("settings.account.image_too_large"), "error");
      return;
    }

    setProcessingImage(true);
    try {
      setAvatarUrl(await optimizeAvatar(file));
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : t("settings.account.image_processing_failed"),
        "error",
      );
    } finally {
      setProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedDisplayName = displayName.trim();
    if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      toast(t("settings.profile.username_invalid"), "error");
      return;
    }
    if (!normalizedDisplayName || normalizedDisplayName.length > 80) {
      toast(t("settings.account.display_name_invalid"), "error");
      return;
    }
    if (avatarUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
      toast(t("settings.account.image_too_large"), "error");
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        username: normalizedUsername,
        displayName: normalizedDisplayName,
        avatarUrl: avatarUrl || null,
      });
      toast(t("settings.account.saved"), "success");
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : t("settings.account.save_failed"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <SettingSection>
        <p className="m-0 text-[13px] text-text-secondary" style={font}>
          {t("settings.account.sign_in_required")}
        </p>
      </SettingSection>
    );
  }

  return (
    <SettingSection>
      <div className="flex flex-col gap-[20px]">
        <div className="flex items-center gap-[16px]">
          <UserAvatar
            key={avatarUrl}
            user={{ ...user, avatarUrl: avatarUrl || null, displayName }}
            size={76}
          />
          <div className="flex flex-wrap gap-[8px]">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="sr-only"
              aria-label={t("settings.account.choose_picture")}
              onChange={(event) =>
                void handleSelectAvatar(event.currentTarget.files?.[0])
              }
            />
            <button
              type="button"
              disabled={processingImage || saving}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-[7px] rounded-[9px] border-0 bg-text-primary px-[12px] py-[8px] text-[12px] font-[600] text-bg-primary transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
              style={font}
            >
              <Camera2Line size={16} />
              {processingImage
                ? t("settings.account.processing_picture")
                : t("settings.account.choose_picture")}
            </button>
            {avatarUrl && (
              <button
                type="button"
                disabled={saving || processingImage}
                onClick={() => setAvatarUrl("")}
                className="inline-flex items-center gap-[7px] rounded-[9px] border border-border-primary/60 bg-transparent px-[12px] py-[8px] text-[12px] text-text-secondary transition-colors hover:bg-black/[0.04] disabled:opacity-60 dark:hover:bg-white/[0.05]"
                style={font}
              >
                <Delete2Line size={16} />
                {t("settings.account.remove_picture")}
              </button>
            )}
          </div>
        </div>

        <label
          className="flex flex-col gap-[6px] text-[12px] text-text-secondary"
          style={font}
        >
          {t("settings.profile.username_label")}
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            maxLength={30}
            className={inputClass}
            style={font}
          />
        </label>

        <label
          className="flex flex-col gap-[6px] text-[12px] text-text-secondary"
          style={font}
        >
          {t("settings.profile.display_name_label")}
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
            maxLength={80}
            placeholder={t("settings.profile.display_name_placeholder")}
            className={inputClass}
            style={font}
          />
        </label>

        <label
          className="flex flex-col gap-[6px] text-[12px] text-text-secondary"
          style={font}
        >
          {t("settings.account.email_label")}
          <input
            value={user.email ?? ""}
            readOnly
            className={`${inputClass} cursor-not-allowed opacity-65`}
            style={font}
          />
        </label>

        <p
          className="m-0 text-[11px] leading-relaxed text-text-tertiary"
          style={font}
        >
          {t("settings.account.picture_hint")}
        </p>

        <div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || processingImage}
            className="rounded-[9px] border-0 bg-text-primary px-[16px] py-[9px] text-[12px] font-[600] text-bg-primary transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
            style={font}
          >
            {saving
              ? t("settings.profile.saving")
              : t("settings.profile.save_changes")}
          </button>
        </div>
      </div>
    </SettingSection>
  );
}
