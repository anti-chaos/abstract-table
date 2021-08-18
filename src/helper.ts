function getColTitle(index: number): string {
  const num = index + 1;

  return num <= 26
    ? String.fromCharCode('A'.charCodeAt(0) - 1 + num)
    : getColTitle(~~((num - 1) / 26)) + getColTitle(num % 26 || 26);
}

function getTitleCoord(colIndex: number, rowIndex: number): string;
function getTitleCoord(
  colIndex: number,
  rowIndex: number,
  endColIndex: number,
  endRowIndex: number,
): string;
function getTitleCoord(
  colIndex: number,
  rowIndex: number,
  endColIndex?: number,
  endRowIndex?: number,
): string {
  let coord: string = `${getColTitle(colIndex)}${rowIndex + 1}`;

  if (endColIndex !== undefined && endRowIndex !== undefined) {
    coord += `:${getTitleCoord(endColIndex, endRowIndex)}`;
  }

  return coord;
}

export { getTitleCoord };
