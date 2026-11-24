import { toSearchText } from './search-text';

describe('toSearchText', () => {
  it.each([
    ['Nguyễn Đức Mạnh', 'nguyen duc manh'],
    ['TRẦN THỊ BÌNH', 'tran thi binh'],
    ['Lê Hoàng Cường', 'le hoang cuong'],
    ['Phạm Thu Hà', 'pham thu ha'],
    ['Đặng Ngọc Ánh', 'dang ngoc anh'],
    ['Ưng Hoàng Phúc', 'ung hoang phuc'],
    ['Vũ Thị Ơn', 'vu thi on'],
    ['already plain', 'already plain'],
  ])('%s → %s', (input, expected) => {
    expect(toSearchText(input)).toBe(expected);
  });

  it('makes accented and unaccented queries meet', () => {
    expect(toSearchText('Nguyễn').includes(toSearchText('nguyen'))).toBe(true);
    expect(toSearchText('Nguyễn').includes(toSearchText('NGUYỄN'))).toBe(true);
  });
});
