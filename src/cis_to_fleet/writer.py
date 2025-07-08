"""File writing utilities for CIS benchmark output."""

from pathlib import Path


def output_path(folder: str, out_dir: Path) -> Path:
    """Generate output file path for a given folder name.
    
    Args:
        folder: The original folder name (e.g., 'macos-15', 'windows-11').
        out_dir: The output directory path.
        
    Returns:
        Path object for the output file with hyphens stripped from folder name.
        
    Example:
        >>> output_path('macos-15', Path('./output'))
        Path('./output/cis-benchmark-macos15.yml')
    """
    clean_folder = folder.replace('-', '')
    filename = f"cis-benchmark-{clean_folder}.yml"
    return out_dir / filename


def write(text: str, path: Path, overwrite: bool = False) -> None:
    """Write text content to a file.
    
    Args:
        text: The text content to write.
        path: The file path to write to.
        overwrite: If True, overwrite existing files. If False, raise FileExistsError.
        
    Raises:
        FileExistsError: If the file exists and overwrite is False.
        OSError: If there are permission or other I/O errors.
    """
    # Ensure parent directory exists
    path.parent.mkdir(parents=True, exist_ok=True)
    
    # Check if file exists and overwrite is not allowed
    if path.exists() and not overwrite:
        raise FileExistsError(f"File already exists: {path}")
    
    # Write the content
    path.write_text(text, encoding="utf-8")