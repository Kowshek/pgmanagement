import { formatINR, initialsOf } from '../format';

describe('formatINR', () => {
  it('formats small amounts without grouping', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(999)).toBe('₹999');
  });

  it('uses Indian lakh grouping', () => {
    expect(formatINR(1000)).toBe('₹1,000');
    expect(formatINR(8500)).toBe('₹8,500');
    expect(formatINR(123456)).toBe('₹1,23,456');
    expect(formatINR(1234567)).toBe('₹12,34,567');
    expect(formatINR(12345678)).toBe('₹1,23,45,678');
  });

  it('handles negatives, strings and junk', () => {
    expect(formatINR(-8500)).toBe('-₹8,500');
    expect(formatINR('9000')).toBe('₹9,000');
    expect(formatINR(undefined)).toBe('₹0');
    expect(formatINR('not a number')).toBe('₹0');
  });

  it('rounds fractional amounts', () => {
    expect(formatINR(8500.6)).toBe('₹8,501');
  });
});

describe('initialsOf', () => {
  it('takes first and last name initials', () => {
    expect(initialsOf('Rahul Sharma')).toBe('RS');
    expect(initialsOf('Priya Kumari Singh')).toBe('PS');
  });

  it('handles single names and junk', () => {
    expect(initialsOf('rahul')).toBe('R');
    expect(initialsOf('  ')).toBe('?');
    expect(initialsOf(undefined)).toBe('?');
  });
});
