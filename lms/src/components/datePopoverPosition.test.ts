import {describe, expect, it} from 'vitest';
import {datePopoverPosition} from './datePopoverPosition';

const popup = {width: 320, height: 450};
const viewport = {left: 0, top: 0, right: 1440, bottom: 900};

describe('date popover placement', () => {
  it('prefers the right side of a field with sufficient room', () => {
    const anchor = {left: 200, right: 700, top: 200, bottom: 248};
    const position = datePopoverPosition(anchor, popup, viewport);
    expect(position.left).toBeGreaterThan(anchor.right);
    expect(position.top).toBe(anchor.top);
  });

  it('right-aligns below a full-width input without overlapping it', () => {
    const anchor = {left: 340, right: 1350, top: 100, bottom: 148};
    const position = datePopoverPosition(anchor, popup, viewport);
    expect(position.left + popup.width).toBe(anchor.right);
    expect(position.top).toBeGreaterThan(anchor.bottom);
  });

  it('moves above a field near the bottom edge', () => {
    const anchor = {left: 340, right: 1350, top: 790, bottom: 838};
    const position = datePopoverPosition(anchor, popup, viewport);
    expect(position.top + Math.min(popup.height, position.maxHeight)).toBeLessThan(anchor.top);
  });

  it('keeps the edited field clear within a shortened mobile visual viewport', () => {
    const anchor = {left: 20, right: 370, top: 280, bottom: 328};
    const mobile = {left: 0, right: 390, top: 120, bottom: 490};
    const position = datePopoverPosition(anchor, popup, mobile);
    expect(position.left).toBeGreaterThanOrEqual(mobile.left);
    expect(position.left + popup.width).toBeLessThanOrEqual(mobile.right);
    expect(position.maxHeight).toBeLessThan(popup.height);
    expect(position.top).toBeGreaterThan(anchor.bottom);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(mobile.bottom);
  });
});
