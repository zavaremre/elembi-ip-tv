#!/usr/bin/env bash
#
# Builds ffmpeg and ffprobe for one macOS architecture, from source.
#
# macOS is the one platform with no redistributable prebuilt to download. The
# binaries everyone reaches for first — the ones ffmpeg-static publishes — are
# configured with --enable-nonfree, and FFmpeg's own terms forbid distributing
# those at all. BtbN, who do publish clean LGPL builds, does not build macOS.
#
# So this compiles one: no external libraries, so nothing drags a GPL or
# nonfree dependency in, and configure prints "LGPL version 2.1 or later". It
# needs no Homebrew, only the Xcode command line tools. On a 14-core machine it
# takes about half a minute; a CI runner with fewer cores takes a few minutes,
# which is why the workflow caches the result against this file's checksum.
#
# Everything the player asks of ffmpeg is in the default LGPL set: AC-3, E-AC-3,
# DTS and TrueHD decoders, the native AAC encoder, the Matroska and MPEG-TS
# demuxers, the HLS and WebVTT muxers, and https through SecureTransport.
#
# Usage: build-ffmpeg-macos.sh <arm64|x86_64> <output-dir>

set -euo pipefail

VERSION=8.1.3
SHA256=7138d28c96d9d3e3af4ee3d8cad72741f8ffb40da90c1112235dea3ecd3178a3

ARCH="${1:-}"
OUT="${2:-}"
if [[ "$ARCH" != "arm64" && "$ARCH" != "x86_64" ]] || [[ -z "$OUT" ]]; then
  echo "usage: $0 <arm64|x86_64> <output-dir>" >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

TARBALL="ffmpeg-$VERSION.tar.xz"
echo "==> ffmpeg $VERSION kaynağı indiriliyor"
curl -fsSL -o "$WORK/$TARBALL" "https://ffmpeg.org/releases/$TARBALL"

echo "$SHA256  $WORK/$TARBALL" | shasum -a 256 -c - >/dev/null
echo "==> sha256 doğrulandı"

tar xf "$WORK/$TARBALL" -C "$WORK"
cd "$WORK/ffmpeg-$VERSION"

# The ${arr[@]+"${arr[@]}"} below is for macOS's bash 3.2, where set -u treats
# an empty array as unset and refuses to expand it.
#
# Flags that have to reach the host tools as well as the target. configure's
# --extra-ldflags does not: build-time helpers like bin2c link with the host
# compiler, and on a machine whose command line tools are newer than its Xcode
# they pick an SDK the linker cannot read. SDKROOT covers both, and is already
# set correctly on a CI runner, so this only matters locally.
SDK_FLAGS=()
if [[ -n "${SDKROOT:-}" ]]; then
  SDK_FLAGS=(--host-cflags="-isysroot $SDKROOT" --host-ldflags="-isysroot $SDKROOT")
fi

CROSS=()
EXTRA_CFLAGS="${SDKROOT:+-isysroot $SDKROOT}"
EXTRA_LDFLAGS="$EXTRA_CFLAGS"
if [[ "$ARCH" == "x86_64" && "$(uname -m)" == "arm64" ]]; then
  # Cross-compiling: the x86 assembler would need nasm, which is not part of
  # the command line tools. Dropping it costs some decode speed and nothing
  # else — the player copies video through and only ever decodes audio.
  CROSS=(--enable-cross-compile --arch=x86_64 --cc="clang -arch x86_64")
  EXTRA_CFLAGS="$EXTRA_CFLAGS -arch x86_64"
  EXTRA_LDFLAGS="$EXTRA_LDFLAGS -arch x86_64"
fi

echo "==> $ARCH için yapılandırılıyor"
./configure \
  --prefix="$WORK/install" \
  --disable-gpl \
  --disable-nonfree \
  --disable-doc \
  --disable-ffplay \
  --disable-debug \
  --enable-static \
  --disable-shared \
  --enable-securetransport \
  --disable-x86asm \
  ${CROSS[@]+"${CROSS[@]}"} \
  ${SDK_FLAGS[@]+"${SDK_FLAGS[@]}"} \
  --extra-cflags="$EXTRA_CFLAGS" \
  --extra-ldflags="$EXTRA_LDFLAGS" \
  | tee "$WORK/configure.log" | grep -E '^License'

# The licence line is the whole point of building this ourselves, so a build
# that somehow turned GPL stops here rather than reaching a release.
if ! grep -q '^License: LGPL' "$WORK/configure.log"; then
  echo "HATA: LGPL olmayan yapılandırma, durduruldu" >&2
  exit 1
fi

echo "==> derleniyor"
make -j"$(sysctl -n hw.ncpu)" >/dev/null

mkdir -p "$OUT"
cp ffmpeg ffprobe "$OUT/"
cp COPYING.LGPLv2.1 "$OUT/LICENSE" 2>/dev/null || cp LICENSE.md "$OUT/LICENSE"
chmod +x "$OUT/ffmpeg" "$OUT/ffprobe"

echo "==> bitti: $OUT"
ls -la "$OUT/ffmpeg" "$OUT/ffprobe" | awk '{printf "    %-10s %6.1f MB\n", $NF, $5/1048576}'
