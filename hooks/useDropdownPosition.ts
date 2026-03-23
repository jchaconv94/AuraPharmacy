import { useState, useEffect, useRef } from 'react';
import { DropdownPositioningService } from '../services/DropdownPositioningService';

export const useDropdownPosition = (isOpen: boolean) => {
    const triggerRef = useRef<HTMLDivElement>(null);
    const [menuStyles, setMenuStyles] = useState<React.CSSProperties>({});

    useEffect(() => {
        const updatePosition = () => {
            if (isOpen && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                // Usamos 240 como ancho por defecto, o podríamos pasarlo como parámetro
                const styles = DropdownPositioningService.calculatePosition(
                    rect, 240, window.innerWidth, window.innerHeight
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
    }, [isOpen]);

    return { triggerRef, menuStyles };
};
