-- Migración 023: Turnos simultáneos y capacidad configurable por sala quirúrgica
-- Permite que salas de procedimientos/tratamientos (como Inyecciones Intravítreas)
-- admitan múltiples pacientes en el mismo slot horario según su capacidad física.

ALTER TABLE quirofanos 
ADD COLUMN IF NOT EXISTS permite_simultaneos BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS capacidad_simultanea INTEGER NOT NULL DEFAULT 1;

-- Inicializar la sala de Inyecciones Intravítreas con simultaneidad y cupo de 3 pacientes
UPDATE quirofanos 
SET permite_simultaneos = true, capacidad_simultanea = 3
WHERE codigo IN ('INJ', 'QX3', 'Q03') OR LOWER(nombre) LIKE '%inyecc%' OR LOWER(nombre) LIKE '%intravit%';
