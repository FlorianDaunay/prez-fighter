export interface StageDef {
  id: string;
  name: string;
  /** Music track id (see audio/tracks). */
  music: string;
}

export const STAGES: StageDef[] = [
  { id: "elysee", name: "Cour de l'Élysée", music: "elysee" },
  { id: "meeting", name: "Meeting Bleu Marine", music: "meeting" },
  { id: "republique", name: "Place de la République", music: "republique" },
  { id: "yacht", name: "Yacht Bling-Bling", music: "yacht" },
  { id: "correze", name: "Corrèze sous la pluie", music: "correze" },
  { id: "salon", name: "Salon de l'Agriculture", music: "salon" },
  { id: "arc", name: "Arc de Triomphe, 1944", music: "arc" },
  { id: "plage", name: "Plage du Poitou", music: "plage" },
  { id: "golf", name: "Golf de Mar-a-Trompe", music: "golf" },
  { id: "kremlin", name: "Place Rouge sous la neige", music: "kremlin" },
  { id: "muraille", name: "La Grande Muraille", music: "muraille" },
  { id: "bruxelles", name: "Parlement de Bruxelles", music: "bruxelles" },
  { id: "assemblee", name: "Hémicycle de l'Assemblée", music: "assemblee" },
];

export const stageIndex = (id: string) => Math.max(0, STAGES.findIndex((s) => s.id === id));
