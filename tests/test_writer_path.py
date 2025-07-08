"""Tests for writer.py path functionality."""

from pathlib import Path

import pytest

from cis_to_fleet.writer import output_path


@pytest.mark.parametrize(
    "folder,expected_filename",
    [
        ("macos-15", "cis-benchmark-macos15.yml"),
        ("windows-11", "cis-benchmark-windows11.yml"),
        ("linux-ubuntu-22", "cis-benchmark-linuxubuntu22.yml"),
        ("centos-7", "cis-benchmark-centos7.yml"),
        ("no-hyphens", "cis-benchmark-nohyphens.yml"),
        ("single", "cis-benchmark-single.yml"),
        ("multi-ple-hy-phens", "cis-benchmark-multiplehyphens.yml"),
    ],
)
def test_output_path_hyphen_removal(folder: str, expected_filename: str) -> None:
    """Test that output_path correctly removes hyphens from folder names."""
    out_dir = Path("./output")
    result = output_path(folder, out_dir)
    
    assert result == out_dir / expected_filename
    assert result.name == expected_filename


def test_output_path_with_different_directories() -> None:
    """Test output_path with different output directories."""
    folder = "macos-15"
    expected_filename = "cis-benchmark-macos15.yml"
    
    # Test with relative path
    result1 = output_path(folder, Path("./output"))
    assert result1 == Path("./output") / expected_filename
    
    # Test with absolute path
    abs_dir = Path("/tmp/fleet-output")
    result2 = output_path(folder, abs_dir)
    assert result2 == abs_dir / expected_filename
    
    # Test with nested path
    nested_dir = Path("./data/output/benchmarks")
    result3 = output_path(folder, nested_dir)
    assert result3 == nested_dir / expected_filename


def test_output_path_preserves_directory_structure() -> None:
    """Test that output_path preserves the directory structure."""
    folder = "windows-11"
    out_dir = Path("./output/benchmarks")
    
    result = output_path(folder, out_dir)
    
    assert result.parent == out_dir
    assert result.name == "cis-benchmark-windows11.yml"