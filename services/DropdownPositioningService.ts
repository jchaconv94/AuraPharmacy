export class DropdownPositioningService {
    static calculatePosition(
        triggerRect: DOMRect,
        dropdownWidth: number,
        viewportWidth: number,
        viewportHeight: number,
        headerHeight: number = 60 // Altura estimada del menú
    ): React.CSSProperties {
        let left = triggerRect.left + triggerRect.width / 2 - dropdownWidth / 2;
        
        // Ajustes de límites laterales
        if (left < 16) left = 16;
        if (left + dropdownWidth > viewportWidth - 16) {
            left = viewportWidth - dropdownWidth - 16;
        }

        // Posicionamiento vertical: asegurar que esté debajo del trigger y no sobre el header
        const top = Math.max(triggerRect.bottom + 4, headerHeight + 10);

        return {
            top: top,
            left: left,
            maxHeight: viewportHeight - top - 20
        };
    }
}
