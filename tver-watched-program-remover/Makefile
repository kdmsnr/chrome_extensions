EXTENSION_ID := tver-watched-program-remover
VERSION := $(shell node -p "require('./manifest.json').version")
DIST_DIR := dist
DIST_FILE := $(DIST_DIR)/$(EXTENSION_ID)-v$(VERSION).zip
DIST_FILES := manifest.json watched-core.js main.js background.js icon.png
USER_SCRIPT := tver-watched-program-remover.user.js
USER_SCRIPT_SOURCES := userscript.meta.js watched-core.js userscript.entry.js

.PHONY: dist clean userscript

userscript: $(USER_SCRIPT)

$(USER_SCRIPT): $(USER_SCRIPT_SOURCES)
	@cat userscript.meta.js watched-core.js userscript.entry.js > $(USER_SCRIPT)
	@echo "Created $(USER_SCRIPT)"

dist: $(DIST_FILE)

$(DIST_FILE): $(DIST_FILES)
	@mkdir -p $(DIST_DIR)
	@rm -f $(DIST_FILE)
	@zip -q -j $(DIST_FILE) $(DIST_FILES)
	@echo "Created $(DIST_FILE)"

clean:
	@rm -rf $(DIST_DIR)
	@echo "Removed $(DIST_DIR)"
