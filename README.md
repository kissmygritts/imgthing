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
