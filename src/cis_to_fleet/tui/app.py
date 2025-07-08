"""Textual TUI application for CIS benchmark platform selection."""

import asyncio
from pathlib import Path
from typing import List, Set

from textual import on, work
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical
from textual.widgets import Button, Checkbox, Footer, Header, ProgressBar, Static

from cis_to_fleet.github import fetch_yaml_sync, list_folders_sync
from cis_to_fleet.transform import raw_yaml_to_list, sanitise_all, to_yaml
from cis_to_fleet.writer import output_path, write


class CISBenchmarkApp(App[None]):
    """Main TUI application for CIS benchmark platform selection."""
    
    CSS = """
    Vertical {
        height: 1fr;
        margin: 1 2;
    }
    
    Horizontal {
        height: auto;
        margin: 1 0;
    }
    
    Static {
        text-align: center;
        margin: 1;
    }
    
    Button {
        margin: 0 1;
    }
    
    Checkbox {
        margin: 0 1;
    }
    
    .platform-list {
        height: 1fr;
        border: solid $primary;
        margin: 1 0;
        padding: 1;
    }
    """
    
    BINDINGS = [
        ("g", "generate", "Generate"),
        ("q", "quit", "Quit"),
        ("escape", "quit", "Quit"),
    ]
    
    def __init__(self) -> None:
        super().__init__()
        self.platforms: List[str] = []
        self.selected_platforms: Set[str] = set()
    
    def compose(self) -> ComposeResult:
        """Create child widgets for the app."""
        yield Header()
        yield Static("CIS Benchmark Platform Selector", classes="title")
        yield Static("Loading platforms...", id="status")
        
        with Vertical(classes="platform-list", id="platform-container"):
            yield Checkbox("Select All", id="select-all")
        
        yield ProgressBar(id="progress", show_eta=False, visible=False)
        
        with Horizontal():
            yield Button("Generate", variant="primary", id="generate-btn")
            yield Button("Quit", variant="error", id="quit-btn")
        
        yield Footer()
    
    async def on_mount(self) -> None:
        """Fetch platform list when app starts."""
        try:
            self.platforms = list_folders_sync()
            self._populate_platform_list()
            self.query_one("#status", Static).update("Select platforms to generate Fleet YAML files:")
        except Exception as e:
            self.query_one("#status", Static).update(f"Error loading platforms: {e}")
    
    def _populate_platform_list(self) -> None:
        """Populate the container with platform checkboxes."""
        container = self.query_one("#platform-container", Vertical)
        
        # Add platform checkboxes
        for platform in self.platforms:
            checkbox = Checkbox(platform, id=f"platform-{platform}")
            container.mount(checkbox)
    
    @on(Checkbox.Changed)
    def on_checkbox_changed(self, event: Checkbox.Changed) -> None:
        """Handle checkbox state changes."""
        checkbox = event.checkbox
        
        if checkbox.id == "select-all":
            self._handle_select_all(checkbox.value)
        elif checkbox.id and checkbox.id.startswith("platform-"):
            platform = checkbox.id.replace("platform-", "")
            if checkbox.value:
                self.selected_platforms.add(platform)
            else:
                self.selected_platforms.discard(platform)
            self._update_status()
    
    def _handle_select_all(self, select_all: bool) -> None:
        """Handle select all checkbox."""
        for platform in self.platforms:
            platform_checkbox = self.query_one(f"#platform-{platform}", Checkbox)
            platform_checkbox.value = select_all
            
            if select_all:
                self.selected_platforms.add(platform)
            else:
                self.selected_platforms.discard(platform)
        
        self._update_status()
    
    def _update_status(self) -> None:
        """Update the status message with selected platforms."""
        count = len(self.selected_platforms)
        if count == 0:
            status = "No platforms selected"
        elif count == 1:
            status = f"1 platform selected: {next(iter(self.selected_platforms))}"
        else:
            status = f"{count} platforms selected"
        
        self.query_one("#status", Static).update(status)
    
    @on(Button.Pressed, "#generate-btn")
    def on_generate_pressed(self) -> None:
        """Handle generate button press."""
        self.action_generate()
    
    @on(Button.Pressed, "#quit-btn")
    def on_quit_pressed(self) -> None:
        """Handle quit button press."""
        self.exit()
    
    def action_generate(self) -> None:
        """Handle generate action."""
        if not self.selected_platforms:
            self.query_one("#status", Static).update("No platforms selected!")
            return
        
        # Start the generation process
        self.generate_files()
    
    @work(exclusive=True)
    async def generate_files(self) -> None:
        """Generate Fleet YAML files for selected platforms."""
        platforms_to_process = list(self.selected_platforms)
        total_platforms = len(platforms_to_process)
        
        # Show progress bar
        progress = self.query_one("#progress", ProgressBar)
        progress.visible = True
        progress.total = total_platforms
        progress.progress = 0
        
        # Disable generate button
        generate_btn = self.query_one("#generate-btn", Button)
        generate_btn.disabled = True
        
        output_dir = Path("./output")
        generated_files = []
        errors = []
        
        for i, platform in enumerate(platforms_to_process):
            self.query_one("#status", Static).update(f"Processing {platform}... ({i+1}/{total_platforms})")
            
            try:
                # Run in thread to avoid blocking the UI
                raw_yaml = await asyncio.get_event_loop().run_in_executor(
                    None, fetch_yaml_sync, platform
                )
                
                # Transform data
                raw_items = raw_yaml_to_list(raw_yaml)
                sanitised_items = sanitise_all(raw_items)
                output_yaml = to_yaml(sanitised_items)
                
                # Write file
                file_path = output_path(platform, output_dir)
                write(output_yaml, file_path, overwrite=True)
                
                generated_files.append(file_path)
                
            except Exception as e:
                errors.append(f"{platform}: {str(e)}")
            
            # Update progress
            progress.progress = i + 1
        
        # Hide progress bar and re-enable button
        progress.visible = False
        generate_btn.disabled = False
        
        # Show completion status
        if errors:
            error_summary = "; ".join(errors[:3])  # Show first 3 errors
            if len(errors) > 3:
                error_summary += f" (+{len(errors)-3} more)"
            self.query_one("#status", Static).update(f"Completed with errors: {error_summary}")
        else:
            self.query_one("#status", Static).update(f"✅ Generated {len(generated_files)} files in ./output/")


def run_tui() -> None:
    """Run the TUI application."""
    app = CISBenchmarkApp()
    app.run()