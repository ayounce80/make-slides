#!/usr/bin/env python3
"""
Deep PPTX comparison tool - extracts and compares every visual detail
between two PPTX files to identify discrepancies.
"""

import zipfile
import xml.etree.ElementTree as ET
import json
import sys
from pathlib import Path
from collections import defaultdict
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any

# OOXML namespaces
NS = {
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}

# EMU to inches conversion
EMU_PER_INCH = 914400

def emu_to_inches(emu: int) -> float:
    """Convert EMUs to inches"""
    return round(emu / EMU_PER_INCH, 4)

def emu_to_px(emu: int) -> float:
    """Convert EMUs to pixels (96 DPI)"""
    return round(emu / EMU_PER_INCH * 96, 2)

@dataclass
class ShapeInfo:
    """Detailed shape information"""
    slide_num: int
    shape_id: str
    shape_name: str
    shape_type: str  # rect, roundRect, etc.
    x: float  # inches
    y: float
    w: float
    h: float
    fill_color: Optional[str] = None
    fill_transparency: Optional[int] = None
    line_color: Optional[str] = None
    line_width: Optional[float] = None
    rotation: Optional[int] = None
    text_content: Optional[str] = None
    font_size: Optional[float] = None
    font_face: Optional[str] = None
    font_color: Optional[str] = None
    font_bold: bool = False
    rect_radius: Optional[float] = None

@dataclass
class SlideInfo:
    """Slide-level information"""
    slide_num: int
    background_color: Optional[str] = None
    shape_count: int = 0
    text_count: int = 0
    image_count: int = 0
    shapes: List[ShapeInfo] = None

def extract_color(elem) -> Optional[str]:
    """Extract color from various OOXML color elements"""
    if elem is None:
        return None

    # srgbClr - direct RGB
    srgb = elem.find('.//a:srgbClr', NS)
    if srgb is not None:
        return f"#{srgb.get('val', '000000')}"

    # schemeClr - theme color
    scheme = elem.find('.//a:schemeClr', NS)
    if scheme is not None:
        return f"scheme:{scheme.get('val', 'unknown')}"

    return None

def extract_transparency(elem) -> Optional[int]:
    """Extract transparency/alpha from color element"""
    if elem is None:
        return None

    alpha = elem.find('.//a:alpha', NS)
    if alpha is not None:
        val = alpha.get('val', '100000')
        # Convert from 0-100000 to 0-100
        return round(int(val) / 1000)

    return None

def extract_shape_info(shape_elem, slide_num: int) -> Optional[ShapeInfo]:
    """Extract detailed info from a shape element"""

    # Get shape properties
    nv_sp_pr = shape_elem.find('.//p:nvSpPr', NS)
    if nv_sp_pr is None:
        return None

    cnv_pr = nv_sp_pr.find('p:cNvPr', NS)
    shape_id = cnv_pr.get('id', 'unknown') if cnv_pr is not None else 'unknown'
    shape_name = cnv_pr.get('name', 'unknown') if cnv_pr is not None else 'unknown'

    # Get geometry
    sp_pr = shape_elem.find('p:spPr', NS)
    if sp_pr is None:
        return None

    # Position and size
    xfrm = sp_pr.find('a:xfrm', NS)
    if xfrm is None:
        return None

    off = xfrm.find('a:off', NS)
    ext = xfrm.find('a:ext', NS)

    if off is None or ext is None:
        return None

    x = emu_to_inches(int(off.get('x', 0)))
    y = emu_to_inches(int(off.get('y', 0)))
    w = emu_to_inches(int(ext.get('cx', 0)))
    h = emu_to_inches(int(ext.get('cy', 0)))

    # Rotation
    rotation = None
    rot = xfrm.get('rot')
    if rot:
        rotation = int(rot) // 60000  # Convert from 60000ths of a degree

    # Shape type (preset geometry)
    prst_geom = sp_pr.find('a:prstGeom', NS)
    shape_type = prst_geom.get('prst', 'unknown') if prst_geom is not None else 'custom'

    # Fill
    fill_color = None
    fill_transparency = None

    solid_fill = sp_pr.find('a:solidFill', NS)
    if solid_fill is not None:
        fill_color = extract_color(solid_fill)
        fill_transparency = extract_transparency(solid_fill)

    grad_fill = sp_pr.find('a:gradFill', NS)
    if grad_fill is not None:
        # Get first gradient stop color
        gs = grad_fill.find('.//a:gs', NS)
        if gs is not None:
            fill_color = extract_color(gs)
            fill_transparency = extract_transparency(gs)
            if fill_color:
                fill_color = f"gradient:{fill_color}"

    no_fill = sp_pr.find('a:noFill', NS)
    if no_fill is not None:
        fill_color = "none"

    # Line
    line_color = None
    line_width = None
    ln = sp_pr.find('a:ln', NS)
    if ln is not None:
        line_width = ln.get('w')
        if line_width:
            line_width = emu_to_inches(int(line_width))
        line_solid = ln.find('a:solidFill', NS)
        if line_solid is not None:
            line_color = extract_color(line_solid)
        line_no = ln.find('a:noFill', NS)
        if line_no is not None:
            line_color = "none"

    # Text content
    text_content = None
    font_size = None
    font_face = None
    font_color = None
    font_bold = False

    tx_body = shape_elem.find('p:txBody', NS)
    if tx_body is not None:
        texts = []
        for r in tx_body.findall('.//a:r', NS):
            t = r.find('a:t', NS)
            if t is not None and t.text:
                texts.append(t.text)

            # Get run properties
            rPr = r.find('a:rPr', NS)
            if rPr is not None:
                sz = rPr.get('sz')
                if sz:
                    font_size = int(sz) / 100  # Convert from hundredths of a point

                b = rPr.get('b')
                font_bold = b == '1' or b == 'true'

                # Font face
                latin = rPr.find('a:latin', NS)
                if latin is not None:
                    font_face = latin.get('typeface')

                # Font color
                solid = rPr.find('a:solidFill', NS)
                if solid is not None:
                    font_color = extract_color(solid)

        if texts:
            text_content = ' '.join(texts)

    return ShapeInfo(
        slide_num=slide_num,
        shape_id=shape_id,
        shape_name=shape_name,
        shape_type=shape_type,
        x=x, y=y, w=w, h=h,
        fill_color=fill_color,
        fill_transparency=fill_transparency,
        line_color=line_color,
        line_width=line_width,
        rotation=rotation,
        text_content=text_content,
        font_size=font_size,
        font_face=font_face,
        font_color=font_color,
        font_bold=font_bold,
    )

def extract_slide_info(slide_xml: str, slide_num: int) -> SlideInfo:
    """Extract all information from a slide"""
    root = ET.fromstring(slide_xml)

    # Background color
    bg_color = None
    bg = root.find('.//p:bg', NS)
    if bg is not None:
        bg_pr = bg.find('p:bgPr', NS)
        if bg_pr is not None:
            solid = bg_pr.find('a:solidFill', NS)
            if solid is not None:
                bg_color = extract_color(solid)

    # Extract all shapes
    shapes = []
    sp_tree = root.find('.//p:spTree', NS)
    if sp_tree is not None:
        for sp in sp_tree.findall('p:sp', NS):
            shape_info = extract_shape_info(sp, slide_num)
            if shape_info:
                shapes.append(shape_info)

    # Count images
    image_count = len(sp_tree.findall('.//p:pic', NS)) if sp_tree is not None else 0

    # Count text boxes
    text_count = sum(1 for s in shapes if s.text_content)

    return SlideInfo(
        slide_num=slide_num,
        background_color=bg_color,
        shape_count=len(shapes),
        text_count=text_count,
        image_count=image_count,
        shapes=shapes,
    )

def extract_pptx_info(pptx_path: str) -> Dict[str, Any]:
    """Extract all information from a PPTX file"""
    result = {
        'file': pptx_path,
        'slides': [],
        'summary': {
            'total_slides': 0,
            'total_shapes': 0,
            'total_images': 0,
            'shape_types': defaultdict(int),
            'colors_used': set(),
            'fonts_used': set(),
        }
    }

    with zipfile.ZipFile(pptx_path, 'r') as zf:
        # Find all slides
        slide_files = sorted([
            f for f in zf.namelist()
            if f.startswith('ppt/slides/slide') and f.endswith('.xml')
        ], key=lambda x: int(x.replace('ppt/slides/slide', '').replace('.xml', '')))

        result['summary']['total_slides'] = len(slide_files)

        for slide_file in slide_files:
            slide_num = int(slide_file.replace('ppt/slides/slide', '').replace('.xml', ''))
            slide_xml = zf.read(slide_file).decode('utf-8')

            slide_info = extract_slide_info(slide_xml, slide_num)
            result['slides'].append(slide_info)

            result['summary']['total_shapes'] += slide_info.shape_count
            result['summary']['total_images'] += slide_info.image_count

            for shape in slide_info.shapes:
                result['summary']['shape_types'][shape.shape_type] += 1
                if shape.fill_color:
                    result['summary']['colors_used'].add(shape.fill_color)
                if shape.font_face:
                    result['summary']['fonts_used'].add(shape.font_face)

    # Convert sets to lists for JSON serialization
    result['summary']['colors_used'] = sorted(result['summary']['colors_used'])
    result['summary']['fonts_used'] = sorted(result['summary']['fonts_used'])
    result['summary']['shape_types'] = dict(result['summary']['shape_types'])

    return result

def compare_slides(slide1: SlideInfo, slide2: SlideInfo) -> Dict[str, Any]:
    """Compare two slides and return differences"""
    diffs = {
        'slide_num': slide1.slide_num,
        'issues': [],
        'shape_diff': slide1.shape_count - slide2.shape_count,
    }

    # Background
    if slide1.background_color != slide2.background_color:
        diffs['issues'].append({
            'type': 'background',
            'ours': slide1.background_color,
            'zai': slide2.background_color,
        })

    # Shape count
    if abs(slide1.shape_count - slide2.shape_count) > 2:
        diffs['issues'].append({
            'type': 'shape_count',
            'ours': slide1.shape_count,
            'zai': slide2.shape_count,
        })

    # Compare shapes by position (fuzzy matching)
    for shape1 in slide1.shapes:
        # Find closest shape in slide2
        best_match = None
        best_dist = float('inf')

        for shape2 in slide2.shapes:
            dist = abs(shape1.x - shape2.x) + abs(shape1.y - shape2.y)
            if dist < best_dist:
                best_dist = dist
                best_match = shape2

        if best_match and best_dist < 0.5:  # Within 0.5 inches
            # Compare properties
            if shape1.shape_type != best_match.shape_type:
                diffs['issues'].append({
                    'type': 'shape_type_mismatch',
                    'position': f"({shape1.x}, {shape1.y})",
                    'ours': shape1.shape_type,
                    'zai': best_match.shape_type,
                })

            if shape1.fill_color and best_match.fill_color:
                if shape1.fill_color.lower() != best_match.fill_color.lower():
                    diffs['issues'].append({
                        'type': 'fill_color_mismatch',
                        'position': f"({shape1.x}, {shape1.y})",
                        'ours': shape1.fill_color,
                        'zai': best_match.fill_color,
                        'shape': shape1.shape_name,
                    })

    return diffs

def main():
    if len(sys.argv) < 3:
        print("Usage: python compare-pptx.py <our_pptx> <zai_pptx> [output_json]")
        sys.exit(1)

    our_pptx = sys.argv[1]
    zai_pptx = sys.argv[2]
    output_json = sys.argv[3] if len(sys.argv) > 3 else None

    print(f"Extracting from: {our_pptx}")
    our_info = extract_pptx_info(our_pptx)

    print(f"Extracting from: {zai_pptx}")
    zai_info = extract_pptx_info(zai_pptx)

    print("\n" + "="*80)
    print("SUMMARY COMPARISON")
    print("="*80)

    print(f"\n{'Metric':<25} {'Ours':>15} {'Z.AI':>15} {'Diff':>10}")
    print("-"*65)
    print(f"{'Total Slides':<25} {our_info['summary']['total_slides']:>15} {zai_info['summary']['total_slides']:>15}")
    print(f"{'Total Shapes':<25} {our_info['summary']['total_shapes']:>15} {zai_info['summary']['total_shapes']:>15} {our_info['summary']['total_shapes'] - zai_info['summary']['total_shapes']:>+10}")
    print(f"{'Total Images':<25} {our_info['summary']['total_images']:>15} {zai_info['summary']['total_images']:>15}")

    print(f"\n{'Shape Types':<25}")
    all_types = set(our_info['summary']['shape_types'].keys()) | set(zai_info['summary']['shape_types'].keys())
    for st in sorted(all_types):
        ours = our_info['summary']['shape_types'].get(st, 0)
        zai = zai_info['summary']['shape_types'].get(st, 0)
        print(f"  {st:<23} {ours:>15} {zai:>15} {ours - zai:>+10}")

    print(f"\nColors used (Ours): {len(our_info['summary']['colors_used'])}")
    for c in our_info['summary']['colors_used'][:20]:
        print(f"  {c}")
    if len(our_info['summary']['colors_used']) > 20:
        print(f"  ... and {len(our_info['summary']['colors_used']) - 20} more")

    print(f"\nColors used (Z.AI): {len(zai_info['summary']['colors_used'])}")
    for c in zai_info['summary']['colors_used'][:20]:
        print(f"  {c}")
    if len(zai_info['summary']['colors_used']) > 20:
        print(f"  ... and {len(zai_info['summary']['colors_used']) - 20} more")

    print(f"\nFonts (Ours): {our_info['summary']['fonts_used']}")
    print(f"Fonts (Z.AI): {zai_info['summary']['fonts_used']}")

    # Slide-by-slide comparison
    print("\n" + "="*80)
    print("SLIDE-BY-SLIDE COMPARISON")
    print("="*80)

    all_diffs = []
    for i, (our_slide, zai_slide) in enumerate(zip(our_info['slides'], zai_info['slides'])):
        diffs = compare_slides(our_slide, zai_slide)
        all_diffs.append(diffs)

        if diffs['issues']:
            print(f"\nSlide {i+1}: {len(diffs['issues'])} issues")
            for issue in diffs['issues'][:5]:  # Show first 5 issues
                print(f"  - {issue['type']}: ours={issue.get('ours')}, zai={issue.get('zai')}")
            if len(diffs['issues']) > 5:
                print(f"  ... and {len(diffs['issues']) - 5} more issues")

    # Detailed slide dump
    print("\n" + "="*80)
    print("DETAILED SLIDE ANALYSIS")
    print("="*80)

    for i, (our_slide, zai_slide) in enumerate(zip(our_info['slides'][:5], zai_info['slides'][:5])):
        print(f"\n--- Slide {i+1} ---")
        print(f"Background: Ours={our_slide.background_color}, Z.AI={zai_slide.background_color}")
        print(f"Shapes: Ours={our_slide.shape_count}, Z.AI={zai_slide.shape_count}")
        print(f"Images: Ours={our_slide.image_count}, Z.AI={zai_slide.image_count}")

        print(f"\nOur shapes (first 10):")
        for shape in our_slide.shapes[:10]:
            print(f"  {shape.shape_type:15} @ ({shape.x:.2f}, {shape.y:.2f}) {shape.w:.2f}x{shape.h:.2f} fill={shape.fill_color} text={shape.text_content[:30] if shape.text_content else None}")

        print(f"\nZ.AI shapes (first 10):")
        for shape in zai_slide.shapes[:10]:
            print(f"  {shape.shape_type:15} @ ({shape.x:.2f}, {shape.y:.2f}) {shape.w:.2f}x{shape.h:.2f} fill={shape.fill_color} text={shape.text_content[:30] if shape.text_content else None}")

    # Save detailed JSON
    if output_json:
        output = {
            'ours': {
                'file': our_info['file'],
                'summary': our_info['summary'],
                'slides': [asdict(s) if hasattr(s, '__dataclass_fields__') else s for s in our_info['slides']],
            },
            'zai': {
                'file': zai_info['file'],
                'summary': zai_info['summary'],
                'slides': [asdict(s) if hasattr(s, '__dataclass_fields__') else s for s in zai_info['slides']],
            },
            'diffs': all_diffs,
        }

        # Convert SlideInfo to dict
        for key in ['ours', 'zai']:
            output[key]['slides'] = []
            for slide in (our_info if key == 'ours' else zai_info)['slides']:
                slide_dict = {
                    'slide_num': slide.slide_num,
                    'background_color': slide.background_color,
                    'shape_count': slide.shape_count,
                    'text_count': slide.text_count,
                    'image_count': slide.image_count,
                    'shapes': [asdict(s) for s in slide.shapes],
                }
                output[key]['slides'].append(slide_dict)

        with open(output_json, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"\nDetailed comparison saved to: {output_json}")

if __name__ == '__main__':
    main()
