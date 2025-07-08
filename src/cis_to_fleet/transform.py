"""Transform CIS benchmark YAML data for Fleet compatibility."""

import io
from typing import Any

from ruamel.yaml import YAML
from ruamel.yaml.scalarstring import LiteralScalarString


ALLOWED_KEYS = ["name", "platform", "description", "resolution", "query"]


def raw_yaml_to_list(yaml_str: str) -> list[dict[str, Any]]:
    """Parse raw YAML string into a list of dictionaries.
    
    Handles multiple YAML documents and extracts policy specs.
    
    Args:
        yaml_str: Raw YAML content as a string.
        
    Returns:
        List of dictionaries parsed from the YAML.
        
    Raises:
        Exception: If YAML parsing fails or format is unexpected.
    """
    yaml = YAML(typ="safe", pure=True)
    
    # Try to load all documents from the YAML stream
    documents = list(yaml.load_all(yaml_str))
    
    # Extract policy specs from Kubernetes-style documents
    policies = []
    for doc in documents:
        if isinstance(doc, dict):
            if doc.get("kind") == "policy" and "spec" in doc:
                # Extract the spec which contains the actual policy data
                policies.append(doc["spec"])
            elif isinstance(doc, list):
                # Handle direct list format
                policies.extend(doc)
            elif "policies" in doc:
                # Handle wrapped format
                policies.extend(doc["policies"])
    
    if not policies:
        raise ValueError("No policies found in YAML documents")
    
    return policies


def sanitise(item: dict[str, Any]) -> dict[str, Any]:
    """Sanitise a single policy item by keeping only allowed keys in order.
    
    Args:
        item: Dictionary representing a single policy item.
        
    Returns:
        Dictionary with only the allowed keys in the specified order.
    """
    sanitised = {}
    for key in ALLOWED_KEYS:
        if key in item:
            value = item[key]
            # Convert multiline strings to literal scalar strings
            if isinstance(value, str) and '\n' in value:
                sanitised[key] = LiteralScalarString(value)
            else:
                sanitised[key] = value
    return sanitised


def sanitise_all(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sanitise all policy items in a list.
    
    Args:
        items: List of policy item dictionaries.
        
    Returns:
        List of sanitised policy items.
    """
    return [sanitise(item) for item in items]


def filter_by_level(items: list[dict[str, Any]], level: str) -> list[dict[str, Any]]:
    """Filter policy items by CIS level.
    
    Args:
        items: List of policy item dictionaries.
        level: CIS level to filter by ("1" or "2").
        
    Returns:
        List of policy items matching the specified level.
    """
    if level not in ["1", "2"]:
        raise ValueError(f"Invalid level '{level}'. Must be '1' or '2'.")
    
    level_tag = f"CIS_Level{level}"
    level_tag_alt = f"CIS_LEVEL{level}"  # Handle alternative capitalization
    
    filtered_items = []
    for item in items:
        tags = item.get("tags", "")
        if isinstance(tags, str):
            # Split comma-separated tags and check for level
            tag_list = [tag.strip() for tag in tags.split(",")]
            if level_tag in tag_list or level_tag_alt in tag_list:
                filtered_items.append(item)
    
    return filtered_items


def to_yaml(items: list[dict[str, Any]]) -> str:
    """Convert list of policy items to YAML string format.
    
    Args:
        items: List of policy item dictionaries.
        
    Returns:
        YAML string representation with proper formatting.
    """
    yaml = YAML()
    yaml.indent(mapping=2, sequence=2, offset=0)
    yaml.default_flow_style = False
    yaml.explicit_start = False
    yaml.explicit_end = False
    
    # Configure for clean output
    yaml.preserve_quotes = False
    yaml.width = 4096  # Prevent line wrapping
    yaml.map_indent = 2
    yaml.sequence_indent = 2
    
    output = io.StringIO()
    yaml.dump(items, output)
    return output.getvalue()