import { escapeCsvCell, toCsvLine } from './csv';

describe('csv', () => {
  it('leaves plain values alone', () => {
    expect(escapeCsvCell('Nguyễn Văn An')).toBe('Nguyễn Văn An');
    expect(escapeCsvCell(1500000)).toBe('1500000');
  });

  it('renders null and undefined as empty cells', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('quotes cells containing commas, quotes or newlines', () => {
    expect(escapeCsvCell('Hà Nội, Việt Nam')).toBe('"Hà Nội, Việt Nam"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it.each(['=HYPERLINK("x")', '+1+1', '-2+3', '@SUM(A1)'])(
    'neutralises formula %s',
    (value) => {
      expect(escapeCsvCell(value).replace(/^"/, '')).toMatch(/^'/);
    },
  );

  it('does not prefix negative numbers', () => {
    expect(escapeCsvCell(-5)).toBe('-5');
  });

  it('builds a CRLF-terminated line', () => {
    expect(toCsvLine(['a', 1, null, 'b,c'])).toBe('a,1,,"b,c"\r\n');
  });
});
