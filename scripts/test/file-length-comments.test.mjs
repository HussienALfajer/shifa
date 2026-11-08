import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countCodeLines } from '../lib/file-length.mjs';

describe('countCodeLines block comments after code', () => {
  it('skips the following lines of a block comment that opens after code', () => {
    assert.equal(countCodeLines('final a = 1; /* note\n still note\n end */\nfinal b = 2;'), 2);
  });

  it('does not open a block for a comment closed on the same line', () => {
    assert.equal(countCodeLines('final a = 1; /* note */\nfinal b = 2;'), 2);
  });
});
