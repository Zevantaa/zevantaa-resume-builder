"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Precision = "day" | "month" | "year";
type Stage = Precision | "decade";
type Position = { top: number; left: number; width: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (value: number) => String(value).padStart(2, "0");

export function CareerDatePicker({ id, label, value, precision, disabled = false, onChange }: {
  id: string; label: string; value: string; precision: Precision; disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>(precision);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)) || new Date().getFullYear());
  const [month, setMonth] = useState(() => Number(value.slice(5, 7)) - 1 || 0);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0, width: 320 });

  const positionPanel = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    if (rect.bottom < 0 || rect.top > window.innerHeight) { setOpen(false); return; }
    const width = Math.min(320, window.innerWidth - 28);
    const height = panel.current?.offsetHeight || 330;
    const above = window.innerHeight - rect.bottom < height + 8 && rect.top >= height + 8;
    setPosition({ top: Math.max(8, above ? rect.top - height - 7 : Math.min(rect.bottom + 7, window.innerHeight - height - 8)),
      left: Math.max(14, Math.min(rect.left, window.innerWidth - width - 14)), width });
  }, []);

  useEffect(() => {
    if (!open) return;
    const reposition = () => positionPanel();
    const closeOutside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    const observer = new ResizeObserver(reposition);
    if (panel.current) observer.observe(panel.current);
    positionPanel();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { observer.disconnect(); window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition); document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape); };
  }, [open, positionPanel]);

  function chooseYear(nextYear: number) {
    setYear(nextYear);
    if (precision === "year") { onChange(String(nextYear)); setOpen(false); trigger.current?.focus(); }
    else setStage("month");
  }
  function chooseMonth(nextMonth: number) {
    setMonth(nextMonth);
    if (precision === "month") { onChange(`${year}-${pad(nextMonth + 1)}`); setOpen(false); trigger.current?.focus(); }
    else setStage("day");
  }
  function navigate(direction: -1 | 1) {
    if (stage === "day") {
      const date = new Date(year, month + direction, 1);
      setYear(date.getFullYear()); setMonth(date.getMonth());
    } else setYear((current) => current + direction * (stage === "decade" ? 100 : stage === "year" ? 12 : 1));
  }
  const title = stage === "day" ? `${MONTHS[month]} ${year}` : stage === "month" ? String(year)
    : stage === "year" ? `${Math.floor(year / 12) * 12}–${Math.floor(year / 12) * 12 + 11}`
      : `${Math.floor(year / 100) * 100}–${Math.floor(year / 100) * 100 + 99}`;
  const display = !value ? "Select date" : precision === "day" ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : precision === "month" ? `${MONTHS[Number(value.slice(5, 7)) - 1] ?? ""} ${value.slice(0, 4)}` : value;
  const days = new Date(year, month + 1, 0).getDate();
  const dayOffset = (new Date(year, month, 1).getDay() + 6) % 7;

  return <div className="form-field career-date-field">
    <label htmlFor={id}>{label}</label>
    <button aria-expanded={open} aria-haspopup="dialog" className="career-date-trigger" disabled={disabled} id={id}
      onClick={() => { setStage(precision); setOpen((current) => !current); }} ref={trigger} type="button">
      <span>{display}</span><span aria-hidden="true">▦</span>
    </button>
    {open && typeof document !== "undefined" && createPortal(<div aria-label={`${label} date picker`} aria-modal="false"
      className="career-date-popover" ref={panel} role="dialog" style={position}>
      <div className="career-date-head">
        <button aria-label="Choose month, year or decade" onClick={() => setStage((current) => current === "day" ? "month" : current === "month" ? "year" : "decade")} type="button">{title}</button>
        <div><button aria-label="Previous period" onClick={() => navigate(-1)} type="button">‹</button>
          <button aria-label="Next period" onClick={() => navigate(1)} type="button">›</button></div>
      </div>
      {stage === "decade" && <div className="career-date-grid">{Array.from({ length: 10 }, (_, index) => Math.floor(year / 100) * 100 + index * 10)
        .map((start) => <button key={start} onClick={() => { setYear(start); setStage("year"); }} type="button">{start}s</button>)}</div>}
      {stage === "year" && <div className="career-date-grid">{Array.from({ length: 12 }, (_, index) => Math.floor(year / 12) * 12 + index)
        .map((option) => <button key={option} onClick={() => chooseYear(option)} type="button">{option}</button>)}</div>}
      {stage === "month" && <div className="career-date-grid">{MONTHS.map((option, index) => <button key={option} onClick={() => chooseMonth(index)} type="button">{option}</button>)}</div>}
      {stage === "day" && <div className="career-date-grid career-date-grid--days">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span aria-hidden="true" key={index}>{day}</span>)}
        {Array.from({ length: dayOffset }, (_, index) => <span key={`pad-${index}`} />)}
        {Array.from({ length: days }, (_, index) => index + 1).map((day) => <button key={day}
          onClick={() => { onChange(`${year}-${pad(month + 1)}-${pad(day)}`); setOpen(false); trigger.current?.focus(); }} type="button">{day}</button>)}
      </div>}
      <div className="career-date-footer">
        <button onClick={() => { const today = new Date(); setYear(today.getFullYear()); setMonth(today.getMonth());
          onChange(precision === "year" ? String(today.getFullYear()) : precision === "month" ? `${today.getFullYear()}-${pad(today.getMonth() + 1)}`
            : `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`); setOpen(false); }} type="button">Today</button>
        <button onClick={() => { onChange(""); setOpen(false); }} type="button">Clear</button>
        <button onClick={() => setOpen(false)} type="button">Done</button>
      </div>
    </div>, document.body)}
  </div>;
}
