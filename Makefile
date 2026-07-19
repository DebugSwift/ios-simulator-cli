.PHONY: help build install uninstall test clean deps watch

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build     Compile TypeScript to build/"
	@echo "  install   Build and install globally (npm install -g .)"
	@echo "  uninstall Remove global install"
	@echo "  deps      Install npm dependencies"
	@echo "  test      Run scripts/test-all.sh"
	@echo "  watch     Rebuild on file changes"
	@echo "  clean     Remove build output and node_modules"

deps:
	npm install

build: deps
	npm run build

install: build
	npm install -g .

uninstall:
	npm uninstall -g @debugswift/ios-simulator-cli || true

test: build
	bash scripts/test-all.sh

watch:
	npm run watch

clean:
	rm -rf build node_modules
