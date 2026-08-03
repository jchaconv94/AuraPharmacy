import { describe, test, expect } from 'vitest';
import { DropdownPositioningService } from './DropdownPositioningService';

describe('DropdownPositioningService', () => {
    test('should calculate correct position', () => {
        const triggerRect = {
            top: 100,
            bottom: 150,
            left: 200,
            right: 300,
            width: 100,
            height: 50
        } as DOMRect;
        const dropdownWidth = 240;
        const viewportWidth = 1000;
        const viewportHeight = 800;

        const result = DropdownPositioningService.calculatePosition(
            triggerRect, dropdownWidth, viewportWidth, viewportHeight
        );

        // Expected left: 200 + 100/2 - 240/2 = 200 + 50 - 120 = 130
        // Expected top: 150 + 4 = 154
        expect(result.left).toBe(130);
        expect(result.top).toBe(154);
        expect(result.maxHeight).toBe(800 - 154 - 20);
    });
});
