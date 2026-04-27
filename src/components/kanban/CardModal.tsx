"use client";

import { useState, useEffect, useRef } from "react";
import type { Card, Tag, TagColor, Priority, DeliverableType } from "@/types/kanban";
import { useKanbanStore } from "@/store/kanban-store";
import { useVaultStore } from "@/store/vault-store";
import { SCRIPT_TEMPLATES, type ScriptTemplate } from "@/data/script-templates";
import { TAG_COLORS, TAG_COLOR_OPTIONS, PRIORITY_CONFIG, DELIVERABLE_CONFIG } from "./tag-colors";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

interface Props {
  card: Card;
  onClose: () => void;
}

const DELIVERABLE_TYPES: DeliverableType[] = [
  "Reel", "YouTube", "Short", "Ad", "Post", "Story", "Podcast", "Blog",
];

const PRIORITIES: Priority[] = ["low", "medium", "high"];

export function CardModal({ card, onClose }: Props) {
  const { updateCard, deleteCard, duplicateCard, columns, boards } = useKanbanStore();
  const { vaultPath } = useVaultStore();

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [notes, setNotes] = useState(card.notes ?? "");
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [deliverableType, setDeliverableType] = useState<DeliverableType | null>(card.deliverableType);
  const [priority, setPriority] = useState<Priority>(card.priority ?? "medium");
  const [thumbnailUrl, setThumbnailUrl] = useState(card.thumbnailUrl ?? "");
  const [videoLink, setVideoLink] = useState(card.videoLink ?? "");
  const [tags, setTags] = useState<Tag[]>(card.tags ?? []);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState<TagColor>("blue");
  const [activeTab, setActiveTab] = useState<"script" | "details" | "media">("script");
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const templateBtnRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
  const duration = wordCount > 0 ? Math.ceil(wordCount / 150) : 0;

  const board = boards.find((b) => b.id === card.boardId);
  const column = columns[card.columnId];

  const vaultName = vaultPath ? vaultPath.split("/").pop() || "" : "";
  const obsidianUri = vaultPath && board
    ? `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(
        `ContentApp/Projects/${slugify(board.title)}/${slugify(card.title)}`
      )}`
    : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!showTemplates) return;
    function onClickOutside(e: MouseEvent) {
      if (templateBtnRef.current && templateBtnRef.current.contains(e.target as Node)) return;
      setShowTemplates(false);
      setPendingTemplateId(null);
    }
    const timer = setTimeout(() => document.addEventListener("mousedown", onClickOutside), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [showTemplates]);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      setThumbnailUrl(reader.result as string);
      setUploadingImage(false);
    };
    reader.onerror = () => setUploadingImage(false);
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = "";
  }

  function applyTemplate(template: ScriptTemplate, mode: "replace" | "append") {
    if (mode === "replace") setDescription(template.content);
    else setDescription((d) => d + (d ? "\n\n" : "") + template.content);
    setShowTemplates(false);
    setPendingTemplateId(null);
  }

  function save() {
    updateCard(card.id, {
      title: title.trim() || card.title,
      description,
      notes,
      dueDate: dueDate || null,
      deliverableType,
      priority,
      thumbnailUrl: thumbnailUrl || null,
      videoLink: videoLink || null,
      tags,
    });
    onClose();
  }

  function addTag() {
    const label = newTagLabel.trim();
    if (!label) return;
    setTags((t) => [...t, { id: uid(), label, color: newTagColor }]);
    setNewTagLabel("");
  }

  function removeTag(id: string) {
    setTags((t) => t.filter((tag) => tag.id !== id));
  }

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date(new Date().toDateString());

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="modal-panel content-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-meta">
            {board && (
              <span className="modal-board-badge" style={{ background: board.color + "22", color: board.color }}>
                {board.emoji} {board.title}
              </span>
            )}
            {column && (
              <span className="modal-column-badge">{column.title}</span>
            )}
          </div>
          <div className="modal-header-actions">
            <button
              className="kanban-icon-btn"
              title="Duplicate card"
              onClick={() => { duplicateCard(card.id); onClose(); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button className="kanban-icon-btn" onClick={onClose} title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="modal-title-area">
          <input
            className="modal-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Card title"
          />
        </div>

        {/* Quick metadata row */}
        <div className="modal-meta-row">
          {/* Priority */}
          <div className="modal-meta-field">
            <span className="modal-meta-label">Priority</span>
            <div className="modal-priority-group">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  className={`modal-priority-btn ${priority === p ? "active" : ""}`}
                  style={priority === p ? { background: PRIORITY_CONFIG[p].bg, color: PRIORITY_CONFIG[p].color, borderColor: PRIORITY_CONFIG[p].color + "44" } : {}}
                  onClick={() => setPriority(p)}
                >
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Deliverable */}
          <div className="modal-meta-field">
            <span className="modal-meta-label">Type</span>
            <select
              className="modal-select"
              value={deliverableType ?? ""}
              onChange={(e) => setDeliverableType((e.target.value as DeliverableType) || null)}
            >
              <option value="">— No type —</option>
              {DELIVERABLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DELIVERABLE_CONFIG[t]?.icon} {t}
                </option>
              ))}
            </select>
          </div>

          {/* Due date */}
          <div className="modal-meta-field">
            <span className="modal-meta-label">Due date</span>
            <input
              type="date"
              className={`modal-input modal-date-input ${isOverdue ? "overdue" : ""}`}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          {(["script", "details", "media"] as const).map((tab) => (
            <button
              key={tab}
              className={`modal-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "script" && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              )}
              {tab === "details" && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              {tab === "media" && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="modal-body">
          {activeTab === "script" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label className="modal-label" style={{ margin: 0 }}>Script / Content</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {wordCount > 0 && (
                    <span style={{ fontSize: 11, color: "var(--app-text-muted)" }}>
                      {wordCount} words · ~{duration}m
                    </span>
                  )}
                  <div style={{ position: "relative" }} ref={templateBtnRef}>
                    <button
                      className="kanban-btn-secondary"
                      style={{ fontSize: 11, padding: "3px 8px" }}
                      onClick={() => { setShowTemplates((v) => !v); setPendingTemplateId(null); }}
                    >
                      Templates ▾
                    </button>
                    {showTemplates && (
                      <div className="template-dropdown">
                        {SCRIPT_TEMPLATES.map((t) => (
                          <div key={t.id}>
                            {pendingTemplateId === t.id ? (
                              <div className="template-confirm-row">
                                <span style={{ fontSize: 11, color: "var(--app-text-muted)", flex: 1 }}>Replace or append?</span>
                                <button className="template-action-btn" onClick={() => applyTemplate(t, "replace")}>Replace</button>
                                <button className="template-action-btn" onClick={() => applyTemplate(t, "append")}>Append</button>
                              </div>
                            ) : (
                              <button
                                className="template-item"
                                onClick={() => {
                                  if (!description.trim()) applyTemplate(t, "replace");
                                  else setPendingTemplateId(t.id);
                                }}
                              >
                                <div style={{ fontWeight: 500, fontSize: 12 }}>{t.name}</div>
                                <div style={{ fontSize: 11, color: "var(--app-text-muted)" }}>{t.description}</div>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <textarea
                className="modal-textarea script-editor"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write your script, outline, or content here…

# Hook
Start with a strong opening...

# Body
Main content points...

# CTA
Call to action..."
                rows={12}
              />
              <label className="modal-label" style={{ marginTop: 12 }}>Notes</label>
              <textarea
                className="modal-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Production notes, reminders, feedback…"
                rows={3}
              />
            </>
          )}

          {activeTab === "details" && (
            <>
              <label className="modal-label">Labels</label>
              <div className="modal-tags">
                {tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="kanban-tag removable"
                    style={{ background: TAG_COLORS[tag.color]?.bg, color: TAG_COLORS[tag.color]?.text }}
                  >
                    {tag.label}
                    <button onClick={() => removeTag(tag.id)} aria-label="Remove tag">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                ))}
                {tags.length === 0 && (
                  <span className="modal-empty-tags">No labels yet</span>
                )}
              </div>
              <div className="modal-tag-add">
                <div className="modal-color-picker">
                  {TAG_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      className={`modal-color-swatch ${newTagColor === color ? "selected" : ""}`}
                      style={{ background: TAG_COLORS[color].text }}
                      onClick={() => setNewTagColor(color)}
                      title={color}
                    />
                  ))}
                </div>
                <input
                  className="modal-input modal-tag-input"
                  placeholder="Label name…"
                  value={newTagLabel}
                  onChange={(e) => setNewTagLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTag(); }}
                />
                <button className="kanban-btn-secondary" onClick={addTag}>Add</button>
              </div>
            </>
          )}

          {activeTab === "media" && (
            <>
              <label className="modal-label">Thumbnail</label>
              {/* hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageUpload}
              />
              <div className="modal-thumb-row">
                <button
                  className="kanban-btn-secondary modal-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    "Uploading…"
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Upload image
                    </>
                  )}
                </button>
                <span className="modal-thumb-or">or</span>
                <input
                  className="modal-input"
                  placeholder="Paste image URL…"
                  value={thumbnailUrl.startsWith("data:") ? "" : thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              {thumbnailUrl && (
                <div className="modal-thumbnail-preview" style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnailUrl} alt="Thumbnail preview" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <button
                    className="modal-thumb-clear"
                    onClick={() => setThumbnailUrl("")}
                    title="Remove thumbnail"
                  >×</button>
                </div>
              )}

              <label className="modal-label" style={{ marginTop: 12 }}>Video Link</label>
              <input
                className="modal-input"
                placeholder="YouTube, Drive, Vimeo…"
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
              />
              {videoLink && (
                <a
                  href={videoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-video-link"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open video link
                </a>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            className="kanban-btn-danger"
            onClick={() => { deleteCard(card.id); onClose(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            Delete
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {obsidianUri && (
              <a
                href={obsidianUri}
                className="kanban-btn-secondary"
                title="Open in Obsidian"
                style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open in Obsidian
              </a>
            )}
            <button className="kanban-btn-secondary" onClick={onClose}>Cancel</button>
            <button className="kanban-btn-primary" onClick={save}>Save changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
