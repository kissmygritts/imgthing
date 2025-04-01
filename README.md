# imgthing

An opinionated image processing CLI made with bun.sh and sharpjs.

## Usage

```shell
imgthing -h

Usage: imgthing [options] [command]

A simple CLI of image utilities

Options:
  -V, --version                                 output the version number
  -h, --help                                    display help for command

Commands:
  resize [options] <input>                      Resize an image to the specified dimensions and
                                                formats
  batch [options] <inDirectory> <outDirectory>  Batch process a directory of images
  exif [options] <input>                        Extract EXIF data from an image
  r2-list-buckets                               List objects in the provided bucket
  r2-list-objects <bucket>                      List objects in the provided bucket
  help [command]
```

## Examples

This image tool is very opinionated towards workflows I use. I figure storage is cheap compared to many of the image optimizer tools cloud providers advertise so I'll resize locally, and store all variants of an image once. I understand this is likely not great. But it's a simple place to start. I currently use Cloudflare R2 for images. (I'm considering bunny.net which might change how I implement this workflow).

I store all images I want to resize in a single, flat directory. Then call the following on the directory

```shell
imgthing batch \
  $INPUT_DIRECTORY \
  $OUTPUT_DIRECTORY \
  -s 2560 1600 1080 960 740 450 \
  -f jpg webp -q 70 | jq
```

This will resize the images so the longest side matches each input `-s, --size`. In this case 2560, 1600, 1080, 740, 450. If the image is landscape then the width will match that size. If portrait, then the height. A webp and jpg version for each images is saved. 

The resulting directory structure looks something like:

```text
├── photo-1
│  ├── photo-1.jpg
│  ├── photo-1.metadata.json
│  ├── jpg
│  │  ├── photo-1__450.jpg
│  │  ├── photo-1__740.jpg
│  │  ├── photo-1__960.jpg
│  │  ├── photo-1__1080.jpg
│  │  ├── photo-1__1600.jpg
│  │  └── photo-1__2560.jpg
│  └── webp
│     ├── photo-1__450.webp
│     ├── photo-1__740.webp
│     ├── photo-1__960.webp
│     ├── photo-1__1080.webp
│     ├── photo-1__1600.webp
│     └── photo-1__2560.webp
├── photo-2
│  ├── photo-2.jpg
│  ├── photo-2.metadata.json
│  ├── jpg
│  │  ├── photo-2__450.jpg
│  │  ├── photo-2__740.jpg
│  │  ├── photo-2__960.jpg
│  │  ├── photo-2__1080.jpg
│  │  ├── photo-2__1600.jpg
│  │  └── photo-2__2560.jpg
│  └── webp
│     ├── photo-2__450.webp
│     ├── photo-2__740.webp
│     ├── photo-2__960.webp
│     ├── photo-2__1080.webp
│     ├── photo-2__1600.webp
│     └── photo-2__2560.webp
```

The name of each photo is used as the name of a parent directory, then the format as the second level, then the resized photos, with the size appended at the end of the name. 