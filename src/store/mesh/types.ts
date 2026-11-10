export interface MeshState {
  range: number;
  wireframe: boolean;
  scale: number;
  boxScale: number;
  flatSurface: boolean;
  matrix: MatrixType;
  preview: MeshPreview | null;
}

/** A mesh shown on the Bed mesh card in place of the loaded one, such as a bed soak mesh */
export interface MeshPreview {
  title: string;
  mesh_min: [number, number];
  mesh_max: [number, number];
  matrix: number[][];
  markers: MeshMarker[];
}

/** A point marked on the Bed mesh card's surface, in nozzle coordinates */
export interface MeshMarker {
  x: number;
  y: number;
  label: string;
}

export type MatrixType = 'probed_matrix' | 'mesh_matrix'

export interface BedMeshProfileListEntry {
  name: string;
  active: boolean;
  adaptive: boolean;
  range: number;
}

export interface AppMeshes {
  [index: string]: ProcessedMesh;
}

export interface ProcessedMesh {
  coordinates: MeshCoordinates[];
  dimensions: [number, number];
  range: number;
  min: number;
  mid: number;
  max: number;
}

export interface MeshCoordinates {
  name: string;
  value: number[];
}
