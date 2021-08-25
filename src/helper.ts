const CHAR_BASIS = 'A'.charCodeAt(0);

function convertNumberToName(num: number): string {
  return num <= 26
    ? String.fromCharCode(CHAR_BASIS - 1 + num)
    : convertNumberToName(~~((num - 1) / 26)) + convertNumberToName(num % 26 || 26);
}

function getColTitle(index: number): string {
  return convertNumberToName(index + 1);
}

function getColIndex(title: string): number {
  let index = -1;

  for (let i = 0; i < title.length; i++) {
    index = (index + 1) * 26 + title.charCodeAt(i) - CHAR_BASIS;
  }

  return index;
}

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

export { getColTitle, getColIndex, getTitleCoord };
