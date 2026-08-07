/**
 * Fallback para Safari / WebKit no iPhone, onde CanvasRenderingContext2D.filter
 * existe na especificação mas fica desligado por padrão (e no Chrome do iOS
 * também, porque ele usa o mesmo motor). Aplicamos o mesmo efeito via matriz
 * de cor nos pixels do canvas.
 */

type Matrix = Float32Array; // 4x5: R,G,B,A,offset por linha

function identity(): Matrix {
  return new Float32Array([
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  ]);
}

/** multiplica A × B (aplica B depois A, no sentido CSS left-to-right) */
function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Float32Array(20);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      out[row * 5 + col] =
        a[row * 5 + 0] * b[0 * 5 + col] +
        a[row * 5 + 1] * b[1 * 5 + col] +
        a[row * 5 + 2] * b[2 * 5 + col] +
        a[row * 5 + 3] * b[3 * 5 + col] +
        (col === 4 ? a[row * 5 + 4] : 0);
    }
  }
  return out;
}

function brightness(amount: number): Matrix {
  const m = identity();
  m[0] = m[6] = m[12] = amount;
  return m;
}

function contrast(amount: number): Matrix {
  const m = identity();
  const o = 0.5 * (1 - amount);
  m[0] = m[6] = m[12] = amount;
  m[4] = m[9] = m[14] = o;
  return m;
}

function saturate(amount: number): Matrix {
  const m = identity();
  const inv = 1 - amount;
  const lr = 0.213 * inv;
  const lg = 0.715 * inv;
  const lb = 0.072 * inv;
  m[0] = lr + amount;
  m[1] = lg;
  m[2] = lb;
  m[5] = lr;
  m[6] = lg + amount;
  m[7] = lb;
  m[10] = lr;
  m[11] = lg;
  m[12] = lb + amount;
  return m;
}

function grayscale(amount: number): Matrix {
  return saturate(1 - amount);
}

function sepia(amount: number): Matrix {
  const m = identity();
  const a = Math.min(1, Math.max(0, amount));
  m[0] = 0.393 * a + (1 - a);
  m[1] = 0.769 * a;
  m[2] = 0.189 * a;
  m[5] = 0.349 * a;
  m[6] = 0.686 * a + (1 - a);
  m[7] = 0.168 * a;
  m[10] = 0.272 * a;
  m[11] = 0.534 * a;
  m[12] = 0.131 * a + (1 - a);
  return m;
}

function hueRotate(degrees: number): Matrix {
  const rad = (degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const m = identity();
  m[0] = 0.213 + c * 0.787 - s * 0.213;
  m[1] = 0.715 - c * 0.715 - s * 0.715;
  m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[5] = 0.213 - c * 0.213 + s * 0.143;
  m[6] = 0.715 + c * 0.285 + s * 0.14;
  m[7] = 0.072 - c * 0.072 - s * 0.283;
  m[10] = 0.213 - c * 0.213 - s * 0.787;
  m[11] = 0.715 - c * 0.715 + s * 0.715;
  m[12] = 0.072 + c * 0.928 + s * 0.072;
  return m;
}

const FN =
  /(brightness|contrast|saturate|sepia|grayscale|hue-rotate)\(\s*([-\d.]+)(deg|%)?\s*\)/gi;

/** Converte a cadeia CSS que montamos nos presets numa matriz 4×5 */
export function matrixFromFilterString(filter: string): Matrix | null {
  if (!filter || filter === "none") return null;
  let matrix = identity();
  let matched = false;
  FN.lastIndex = 0;
  let hit: RegExpExecArray | null;
  while ((hit = FN.exec(filter)) !== null) {
    matched = true;
    const name = hit[1].toLowerCase();
    let value = Number(hit[2]);
    const unit = hit[3];
    if (unit === "%") value /= 100;
    let next: Matrix;
    switch (name) {
      case "brightness":
        next = brightness(value);
        break;
      case "contrast":
        next = contrast(value);
        break;
      case "saturate":
        next = saturate(value);
        break;
      case "sepia":
        next = sepia(value);
        break;
      case "grayscale":
        next = grayscale(value);
        break;
      case "hue-rotate":
        next = hueRotate(value);
        break;
      default:
        continue;
    }
    // CSS aplica da esquerda para a direita: o próximo fica "por fora"
    matrix = multiply(next, matrix);
  }
  return matched ? matrix : null;
}

/**
 * Aplica a matriz nos pixels do canvas. Pesado em 4K — o renderer só chama
 * quando o filtro nativo do canvas não está disponível.
 */
export function applySoftwareFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filter: string,
): void {
  const matrix = matrixFromFilterString(filter);
  if (!matrix) return;

  let image: ImageData;
  try {
    image = ctx.getImageData(0, 0, width, height);
  } catch {
    // canvas tainted (não deve acontecer com getUserMedia local)
    return;
  }

  const data = image.data;
  const m = matrix;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    data[i] = Math.min(
      255,
      Math.max(0, m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4] * 255),
    );
    data[i + 1] = Math.min(
      255,
      Math.max(0, m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9] * 255),
    );
    data[i + 2] = Math.min(
      255,
      Math.max(0, m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14] * 255),
    );
  }
  ctx.putImageData(image, 0, 0);
}
