"""Run each authored Python example and compare its documented text output."""
from pathlib import Path
import re
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[2]
count = 0
for post in sorted((root / '_posts').glob('*.md')):
    content = post.read_text(encoding='utf-8')
    blocks = list(re.finditer(r'^```(\w+)\n(.*?)^```', content, re.M | re.S))
    for index, block in enumerate(blocks):
        if block[1] != 'python':
            continue
        following = blocks[index + 1] if index + 1 < len(blocks) else None
        assert following is not None and following[1] == 'text', f'{post.name}: missing expected output'
        with tempfile.TemporaryDirectory() as folder:
            result = subprocess.run([sys.executable, '-X', 'utf8', '-c', block[2]],
                                    cwd=folder, capture_output=True, text=True,
                                    encoding='utf-8', timeout=15)
        assert result.returncode == 0, f'{post.name}: {result.stderr}'
        assert result.stdout.strip() == following[2].strip(), (
            f'{post.name}\nACTUAL:\n{result.stdout}\nEXPECTED:\n{following[2]}')
        count += 1
        print(f'PASS: {post.name}')
print(f'PASS: {count} executable examples matched documented output')
