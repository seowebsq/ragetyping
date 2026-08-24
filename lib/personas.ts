export type PersonaId =
  | "sarcastic"
  | "therapist"
  | "sergeant"
  | "parent"
  | "hr"
  | "bard";

export type Persona = {
  id: PersonaId;
  label: string;
  tag: string;
  premium: boolean;
  /** Appended to the system prompt to set the tone of the single sentence. */
  direction: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "sarcastic",
    label: "Sarcastic mirror",
    tag: "mirror",
    premium: false,
    direction:
      "a hilarious, mocking mirror of how absurd, petty, or over-the-top they sound",
  },
  {
    id: "therapist",
    label: "Empathetic therapist",
    tag: "therapist",
    premium: false,
    direction:
      "calm, empathetic, insightful, helping them notice the real feeling beneath the anger without coddling",
  },
  {
    id: "sergeant",
    label: "Drill sergeant",
    tag: "sergeant",
    premium: false,
    direction:
      "a barking drill sergeant who treats the complaint as a discipline problem and issues one clipped order",
  },
  {
    id: "parent",
    label: "Disappointed parent",
    tag: "parent",
    premium: true,
    direction:
      "a quietly disappointed parent, with no shouting, just the devastating calm of someone who expected better",
  },
  {
    id: "hr",
    label: "Corporate HR",
    tag: "hr",
    premium: true,
    direction:
      "a corporate HR representative smothering the rage in cheerful policy language and synergy-speak",
  },
  {
    id: "bard",
    label: "Shakespearean",
    tag: "bard",
    premium: true,
    direction:
      "an Elizabethan playwright delivering a florid, archaic insult worthy of the Globe",
  },
];

export const DEFAULT_PERSONA: PersonaId = "sarcastic";

export function getPersona(value: unknown): Persona {
  return (
    PERSONAS.find((p) => p.id === value) ??
    PERSONAS.find((p) => p.id === DEFAULT_PERSONA)!
  );
}
