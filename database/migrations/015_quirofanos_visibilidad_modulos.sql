-- Migración 015: Configuración de visibilidad de salas de quirófano vs consultorios de tratamiento
-- Permite desacoplar las salas ambulatorias/consultorio de la Pizarra en Vivo de Quirófano y Recepción

ALTER TABLE quirofanos 
ADD COLUMN IF NOT EXISTS mostrar_en_pizarra BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS mostrar_en_recepcion BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS tipo_sala VARCHAR(50) NOT NULL DEFAULT 'quirofano';

-- Actualizar salas conocidas no quirúrgicas (YAG Láser y Sala de Procedimientos/Inyecciones)
UPDATE quirofanos 
SET mostrar_en_pizarra = false, tipo_sala = 'consultorio'
WHERE codigo IN ('YAG', 'INJ') OR LOWER(nombre) LIKE '%laser%' OR LOWER(nombre) LIKE '%inyecciones%';
