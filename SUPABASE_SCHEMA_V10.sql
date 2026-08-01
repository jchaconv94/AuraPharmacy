ALTER TABLE public.roles_config ADD COLUMN jurisdiction_level TEXT;

-- Update existing roles with approximate jurisdiction levels derived from their codes or labels
UPDATE public.roles_config SET jurisdiction_level = 'GLOBAL' WHERE role LIKE '%ADMIN%' OR role LIKE '%GLOBAL%';
UPDATE public.roles_config SET jurisdiction_level = 'DIRESA' WHERE role LIKE '%DIRESA%';
UPDATE public.roles_config SET jurisdiction_level = 'OGESS' WHERE role LIKE '%OGESS%';
UPDATE public.roles_config SET jurisdiction_level = 'UNGET' WHERE role LIKE '%UNGET%';
UPDATE public.roles_config SET jurisdiction_level = 'MICRORED' WHERE role LIKE '%MICRORED%';
UPDATE public.roles_config SET jurisdiction_level = 'IPRESS' WHERE role LIKE '%FARMACIA%' OR role LIKE '%IPRESS%' OR role LIKE '%PERSONAL%';
