"""Main CLI entry point for cis-to-fleet."""

import sys
from pathlib import Path
from typing import List

import typer

from cis_to_fleet import __version__
from cis_to_fleet.github import fetch_yaml_sync, list_folders_sync
from cis_to_fleet.transform import raw_yaml_to_list, sanitise_all, to_yaml, to_yaml_chunks, filter_by_level
from cis_to_fleet.writer import output_path, write


def version_callback(value: bool) -> None:
    """Print version and exit."""
    if value:
        typer.echo(f"cis-to-fleet {__version__}")
        raise typer.Exit()

app = typer.Typer(
    name="cis-to-fleet",
    help="Convert CIS benchmarks to Fleet-compatible policy files",
)


@app.callback()
def main(
    version: bool = typer.Option(
        False, "--version", callback=version_callback, help="Show version and exit"
    )
) -> None:
    """CIS to Fleet - Convert CIS benchmarks to Fleet-compatible policy files."""
    pass


@app.command()
def list() -> None:
    """List all available CIS benchmark platforms."""
    try:
        folders = list_folders_sync()
        for folder in folders:
            typer.echo(folder)
    except Exception as e:
        typer.echo(f"Error fetching platform list: {e}", err=True)
        raise typer.Exit(1)


@app.command()
def generate(
    platforms: List[str] = typer.Argument(
        None, help="Platform names to generate (leave empty to use --all)"
    ),
    all_platforms: bool = typer.Option(
        False, 
        "--all", 
        help="Generate for all available platforms"
    ),
    level: str = typer.Option(
        "all",
        "--level",
        "-l", 
        help="CIS level to include: 1, 2, or all (default: all)"
    ),
    format: str = typer.Option(
        "combine",
        "--format",
        "-f",
        help="Output format: combine (single file) or split (individual files per policy)"
    ),
    output: Path = typer.Option(
        Path("./output"), 
        "--output", 
        "-o", 
        help="Output directory for generated files"
    ),
    force: bool = typer.Option(
        False, 
        "--force", 
        help="Overwrite existing files without prompting"
    ),
) -> None:
    """Generate Fleet-compatible YAML files for specified platforms."""
    # Validate arguments
    if all_platforms and platforms:
        typer.echo("Error: Cannot specify both --all and platform names.", err=True)
        raise typer.Exit(1)
    
    if not all_platforms and not platforms:
        typer.echo("Error: Must specify either platform names or --all flag.", err=True)
        raise typer.Exit(1)
    
    if level not in ["1", "2", "all"]:
        typer.echo(f"Error: Invalid level '{level}'. Must be '1', '2', or 'all'.", err=True)
        raise typer.Exit(1)
    
    if format not in ["combine", "split"]:
        typer.echo(f"Error: Invalid format '{format}'. Must be 'combine' or 'split'.", err=True)
        raise typer.Exit(1)
    
    # Determine platforms to process
    if all_platforms:
        try:
            platforms_to_process = list_folders_sync()
            typer.echo(f"Found {len(platforms_to_process)} platforms to process.")
        except Exception as e:
            typer.echo(f"Error fetching platform list: {e}", err=True)
            raise typer.Exit(1)
    else:
        platforms_to_process = platforms
    
    exit_code = 0
    
    for platform in platforms_to_process:
        try:
            # Fetch raw YAML content
            typer.echo(f"Fetching YAML for {platform}...")
            raw_yaml = fetch_yaml_sync(platform)
            
            # Parse and transform
            raw_items = raw_yaml_to_list(raw_yaml)
            
            # Filter by level if specified
            if level != "all":
                raw_items = filter_by_level(raw_items, level)
            
            sanitised_items = sanitise_all(raw_items)
            
            if format == "combine":
                # Generate single YAML file with all policies
                output_yaml = to_yaml(sanitised_items)
                file_path = output_path(platform, output)
                write(output_yaml, file_path, overwrite=force)
                typer.echo(f"Generated combined file: {file_path}")
            
            elif format == "split":
                # Generate individual YAML files for each policy
                chunks = to_yaml_chunks(sanitised_items)
                platform_dir = output / platform
                platform_dir.mkdir(parents=True, exist_ok=True)
                
                for policy_name, yaml_content in chunks.items():
                    chunk_path = platform_dir / f"{policy_name}.yml"
                    write(yaml_content, chunk_path, overwrite=force)
                
                typer.echo(f"Generated {len(chunks)} individual policy files in: {platform_dir}")
            
        except FileExistsError:
            typer.echo(
                f"Error: File {output_path(platform, output)} already exists. "
                "Use --force to overwrite.",
                err=True,
            )
            exit_code = 1
        except RuntimeError as e:
            typer.echo(f"Error processing {platform}: {e}", err=True)
            exit_code = 1
        except Exception as e:
            typer.echo(f"Unexpected error processing {platform}: {e}", err=True)
            exit_code = 1
    
    if exit_code != 0:
        raise typer.Exit(exit_code)


@app.command()
def tui() -> None:
    """Launch the interactive TUI for platform selection."""
    from cis_to_fleet.tui.app import run_tui
    run_tui()


if __name__ == "__main__":
    app()