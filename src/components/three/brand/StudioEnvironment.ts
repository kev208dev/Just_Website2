import {
  BackSide,
  BoxGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * A small photographic "studio" baked into a PMREM environment: a near-black
 * room, one large overhead softbox, two narrow strip lights and a warm bronze
 * kicker. Metals pick up long, soft highlights instead of a generic room.
 */
export function createStudioEnvironment(renderer: WebGLRenderer): Texture {
  const scene = new Scene();
  const disposables: { dispose(): void }[] = [];

  const roomGeo = new BoxGeometry(14, 10, 14);
  const roomMat = new MeshBasicMaterial({ color: new Color('#060607'), side: BackSide });
  scene.add(new Mesh(roomGeo, roomMat));
  disposables.push(roomGeo, roomMat);

  const panel = (w: number, h: number, color: string, intensity: number, x: number, y: number, z: number) => {
    const geo = new PlaneGeometry(w, h);
    const mat = new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity), side: DoubleSide, toneMapped: false });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
    disposables.push(geo, mat);
  };

  panel(7, 2.4, '#ffffff', 2.6, 0, 4.6, 1.8); // overhead softbox
  panel(0.5, 6, '#f3efe8', 3.2, -5.6, 0.4, 2.6); // left strip
  panel(0.35, 6, '#eef1f6', 2.2, 5.8, 0.2, 1.2); // right strip (cool)
  panel(3.2, 1.6, '#c88f47', 1.6, 2.4, -2.6, 4.2); // low warm bronze kicker
  panel(5, 0.6, '#ffffff', 0.9, 0, -1.2, -6.4); // faint back rim
  // Front strips behind the camera: the faces read as polished chrome bands instead of black.
  panel(1.4, 8, '#f5f3ee', 2.1, -3.2, 0.6, 6.4);
  panel(0.45, 8, '#ffffff', 1.1, 2.9, 0.4, 6.2);
  panel(9, 1.2, '#d6d0c5', 0.35, 0, -3.4, 5.8); // floor bounce

  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  disposables.forEach((d) => d.dispose());
  return texture;
}
