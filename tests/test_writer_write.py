"""Tests for writer.py write functionality."""

from pathlib import Path

import pytest

from cis_to_fleet.writer import write


def test_write_new_file(tmp_path: Path) -> None:
    """Test writing to a new file."""
    content = "test content\nwith multiple lines"
    file_path = tmp_path / "test_file.yaml"
    
    write(content, file_path)
    
    # Verify file was created and contains expected content
    assert file_path.exists()
    assert file_path.read_text(encoding="utf-8") == content


def test_write_creates_parent_directories(tmp_path: Path) -> None:
    """Test that write creates parent directories if they don't exist."""
    content = "test content"
    file_path = tmp_path / "nested" / "directories" / "test_file.yaml"
    
    write(content, file_path)
    
    # Verify file was created and parent directories exist
    assert file_path.exists()
    assert file_path.parent.exists()
    assert file_path.read_text(encoding="utf-8") == content


def test_write_file_exists_no_overwrite(tmp_path: Path) -> None:
    """Test that write raises FileExistsError when file exists and overwrite=False."""
    content = "original content"
    file_path = tmp_path / "existing_file.yaml"
    
    # Create the file first
    file_path.write_text(content, encoding="utf-8")
    
    # Try to write again without overwrite
    new_content = "new content"
    with pytest.raises(FileExistsError, match=f"File already exists: {file_path}"):
        write(new_content, file_path, overwrite=False)
    
    # Verify original content is preserved
    assert file_path.read_text(encoding="utf-8") == content


def test_write_file_exists_with_overwrite(tmp_path: Path) -> None:
    """Test that write overwrites existing file when overwrite=True."""
    original_content = "original content"
    file_path = tmp_path / "existing_file.yaml"
    
    # Create the file first
    file_path.write_text(original_content, encoding="utf-8")
    
    # Write new content with overwrite=True
    new_content = "new content"
    write(new_content, file_path, overwrite=True)
    
    # Verify new content was written
    assert file_path.read_text(encoding="utf-8") == new_content


def test_write_utf8_encoding(tmp_path: Path) -> None:
    """Test that write handles UTF-8 content correctly."""
    content = "Test with UTF-8: 日本語 français 中文 🎉"
    file_path = tmp_path / "utf8_test.yaml"
    
    write(content, file_path)
    
    # Verify UTF-8 content is preserved
    assert file_path.read_text(encoding="utf-8") == content


def test_write_empty_content(tmp_path: Path) -> None:
    """Test writing empty content."""
    content = ""
    file_path = tmp_path / "empty_file.yaml"
    
    write(content, file_path)
    
    # Verify empty file was created
    assert file_path.exists()
    assert file_path.read_text(encoding="utf-8") == ""


def test_write_multiline_content(tmp_path: Path) -> None:
    """Test writing multiline content with various line endings."""
    content = "Line 1\nLine 2\nLine 3\n"
    file_path = tmp_path / "multiline.yaml"
    
    write(content, file_path)
    
    # Verify multiline content is preserved
    written_content = file_path.read_text(encoding="utf-8")
    assert written_content == content
    assert written_content.count('\n') == 3