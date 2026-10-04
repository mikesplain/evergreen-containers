"""Check installed AND vendored distributions; standalone upgrades are insufficient."""
import email
import pathlib
import sys

MINIMUM = {"jaraco-context": (6, 1, 0), "wheel": (0, 46, 2)}


def check(root):
    seen = set()
    for metadata in pathlib.Path(root).rglob("*.dist-info/METADATA"):
        message = email.message_from_string(metadata.read_text())
        name = message.get("Name", "").lower().replace("_", "-").replace(".", "-")
        if name not in MINIMUM:
            continue
        version = message["Version"]
        parts = tuple(int(part) for part in version.split("."))
        if parts < MINIMUM[name]:
            raise RuntimeError(f"Vulnerable {name} {version}: {metadata}")
        seen.add(name)
        print(f"Packaging contract: {name} {version}: {metadata}")
    if seen != set(MINIMUM):
        raise RuntimeError(f"Missing packaging metadata: {set(MINIMUM) - seen}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        check(sys.argv[1])
    else:
        import sysconfig
        check(sysconfig.get_paths()["purelib"])
        # The bundled driver still imports distutils.version at runtime.
        import undetected_chromedriver
        from distutils.version import LooseVersion
        assert LooseVersion("120.0") > LooseVersion("119.0")
        print("Bundled undetected_chromedriver import passed")
