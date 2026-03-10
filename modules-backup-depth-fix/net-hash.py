#!/usr/bin/env python3
import sys
import json
from Crypto.Hash import keccak

def generate_post_hash(sender, timestamp, topic, text):
    """
    Compute keccak256 hash matching NET Protocol's generatePostHash().
    Uses Solidity's abi.encodePacked format.
    """
    # Pack data exactly as Solidity does
    packed = (
        bytes.fromhex(sender.replace("0x", "").lower().zfill(40))  # address: 20 bytes
        + int(timestamp).to_bytes(32, byteorder="big")              # uint256: 32 bytes
        + topic.encode("utf-8")                                      # string: raw bytes
        + text.encode("utf-8")                                       # string: raw bytes
    )
    
    # Compute keccak256
    k = keccak.new(digest_bits=256, data=packed)
    return "0x" + k.hexdigest()

def encode_metadata(parent_topic, parent_sender, parent_timestamp):
    """
    Encode metadata for comment reply.
    """
    metadata = json.dumps({
        "parentTopic": parent_topic,
        "parentSender": parent_sender,
        "parentTimestamp": int(parent_timestamp)
    })
    return "0x" + metadata.encode("utf-8").hex()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: net-hash.py <command> [args...]", file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "hash":
        # Compute post hash
        # Args: sender timestamp topic text
        if len(sys.argv) != 6:
            print("Usage: net-hash.py hash <sender> <timestamp> <topic> <text>", file=sys.stderr)
            sys.exit(1)
        
        sender = sys.argv[2]
        timestamp = sys.argv[3]
        topic = sys.argv[4]
        text = sys.argv[5]
        
        hash_result = generate_post_hash(sender, timestamp, topic, text)
        print(hash_result)
    
    elif command == "metadata":
        # Encode metadata for reply
        # Args: parent_topic parent_sender parent_timestamp
        if len(sys.argv) != 5:
            print("Usage: net-hash.py metadata <parent_topic> <parent_sender> <parent_timestamp>", file=sys.stderr)
            sys.exit(1)
        
        parent_topic = sys.argv[2]
        parent_sender = sys.argv[3]
        parent_timestamp = sys.argv[4]
        
        metadata_hex = encode_metadata(parent_topic, parent_sender, parent_timestamp)
        print(metadata_hex)
    
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        sys.exit(1)
