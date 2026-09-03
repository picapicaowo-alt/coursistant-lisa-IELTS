import {BookOpen, PenLine, Mic, Headphones} from 'lucide-react';

// Skill codes are supplied by the learning profile, including legacy short codes.
const ICONS: Record<string, typeof BookOpen> = {RD: BookOpen, READING: BookOpen, WR: PenLine, WRITING: PenLine, SP: Mic, SPEAKING: Mic, LS: Headphones, LISTENING: Headphones};
export function SkillIcon({code, size = 24}: {code?: string; size?: number}) {
  const Icon = ICONS[(code || '').toUpperCase()] || BookOpen;
  return <Icon size={size} aria-hidden="true"/>;
}
