export type PersonaId = "sarcastic" | "therapist" | "parent" | "hr";

export type Persona = {
  id: PersonaId;
  label: string;
  tag: string;
  /** Appended to the system prompt to set the tone of the single sentence. */
  direction: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "sarcastic",
    label: "Sarcastic mirror",
    tag: "mirror",
    direction:
      "a hilarious, mocking mirror of how absurd, petty, or over-the-top they sound",
  },
  {
    id: "therapist",
    label: "Empathetic therapist",
    tag: "therapist",
    direction:
      "calm, empathetic, insightful, helping them notice the real feeling beneath the anger without coddling",
  },
  {
    id: "parent",
    label: "Disappointed parent",
    tag: "parent",
    direction:
      "a quietly disappointed parent, with no shouting, just the devastating calm of someone who expected better",
  },
  {
    id: "hr",
    label: "Corporate HR",
    tag: "hr",
    direction:
      "a corporate HR representative smothering the rage in cheerful policy language and synergy-speak",
  },
];

export const DEFAULT_PERSONA: PersonaId = "sarcastic";

export function getPersona(value: unknown): Persona {
  return (
    PERSONAS.find((p) => p.id === value) ??
    PERSONAS.find((p) => p.id === DEFAULT_PERSONA)!
  );
}
