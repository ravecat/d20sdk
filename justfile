package_manager := "pnpm"

default:
    @just --list

setup:
    {{ package_manager }} install --frozen-lockfile

check:
    {{ package_manager }} run check

format:
    {{ package_manager }} run format

lint:
    {{ package_manager }} run lint

lint-fix:
    {{ package_manager }} run lint:fix

typecheck:
    {{ package_manager }} run typecheck
