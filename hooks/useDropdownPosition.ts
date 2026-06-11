import { useState, useEffect, useRef } from 'react';
import { DropdownPositioningService } from '../services/DropdownPositioningService';

export const useDropdownPosition = (
    isOpen: boolean,
    options?: {
        align?: 'left' | 'center' | 'right';
        customWidth?: number;
    }
) => {
    const triggerRef = useRef<HTMLDivElement>(null);
    const [menuStyles, setMenuStyles] = useState<React.CSSProperties>({});

    useEffect(() => {
        const updatePosition = () => {
            if (isOpen && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const width = options?.customWidth ?? rect.width ?? 240;
                const align = options?.align ?? 'center';
                const styles = DropdownPositioningService.calculatePosition(
                    rect, width, window.innerWidth, window.innerHeight, 60, align
                );
                setMenuStyles(styles);
            }
        };

        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, options?.align, options?.customWidth]);

    return { triggerRef, menuStyles };
};
