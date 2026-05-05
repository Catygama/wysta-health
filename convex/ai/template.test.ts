import { describe, it, expect } from 'vitest';
import { renderTemplate } from './template';

describe('renderTemplate', () => {
  it('substitutes a single placeholder', () => {
    expect(renderTemplate('hello {{name}}', { name: 'Maria' })).toBe('hello Maria');
  });

  it('substitutes multiple placeholders', () => {
    expect(renderTemplate('{{a}}-{{b}}', { a: 'x', b: 'y' })).toBe('x-y');
  });

  it('substitutes the same placeholder twice', () => {
    expect(renderTemplate('{{x}}/{{x}}', { x: 'q' })).toBe('q/q');
  });

  it('throws on missing variable (loud, not silent)', () => {
    expect(() => renderTemplate('hi {{name}}', {})).toThrow(/missing variable: name/i);
  });

  it('passes through plain strings unchanged', () => {
    expect(renderTemplate('no placeholders here', { x: '1' })).toBe('no placeholders here');
  });

  it('tolerates whitespace inside braces', () => {
    expect(renderTemplate('hello {{ name }}', { name: 'Maria' })).toBe('hello Maria');
  });
});
