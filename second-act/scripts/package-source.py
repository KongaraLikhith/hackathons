from pathlib import Path
import zipfile
root = Path(__file__).resolve().parent.parent
with zipfile.ZipFile(root/'work/second-act-source.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for folder in ['src', 'tests', 'docs', 'scripts']:
        for path in sorted((root/folder).rglob('*')):
            if path.is_file():
                z.write(path, 'second-act/'+str(path.relative_to(root)))
    for name in ['README.md', 'LICENSE', 'package.json', 'package-lock.json', '.gitignore', '.env.example']:
        path = root/name
        if path.exists(): z.write(path, 'second-act/'+name)
    z.writestr('second-act/.openai/hosting.json', '{"d1": null, "r2": null}\n')
